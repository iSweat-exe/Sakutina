import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import {
    db,
    stocks,
    userHoldings,
    stockPriceHistory,
    transactions,
    users,
} from '@sakutina/db';
import { and, asc, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { computeAvgBuyPrice } from '@sakutina/economy';
import { requireAuth, requireGuildMember } from '../auth/middleware.js';
import { bindGuildId, getGuildId } from '../utils/params.js';
import {
    isNonEmptyString,
    isPositiveInteger,
    parseJsonBody,
} from '../utils/validate.js';
import {
    ensureUser,
    logTransaction,
    getPortfolioSummary,
} from '../lib/economy.js';
import type { AppEnv } from '../types.js';

export const investRoutes = new Hono<AppEnv>();

investRoutes.use('*', bindGuildId, requireAuth, requireGuildMember);

async function getStock(ticker: string) {
    return db
        .select()
        .from(stocks)
        .where(eq(stocks.ticker, ticker))
        .then((res) => res[0]);
}

investRoutes.get('/market', async (c) => {
    const rows = await db.select().from(stocks).orderBy(stocks.ticker);
    return c.json(rows);
});

// Pushes the market snapshot whenever it changes (StockPriceJob ticks it
// once a minute on the bot side) so the panel updates live instead of
// requiring a manual refresh. Falls back to a periodic comment ping to keep
// the connection alive through nginx/proxy idle timeouts.
investRoutes.get('/stream', (c) => {
    return streamSSE(c, async (stream) => {
        let lastSerialized = '';
        let lastSentAt = Date.now();

        while (!stream.aborted) {
            const rows = await db.select().from(stocks).orderBy(stocks.ticker);
            const serialized = JSON.stringify(rows);

            if (serialized !== lastSerialized) {
                lastSerialized = serialized;
                lastSentAt = Date.now();
                await stream.writeSSE({ event: 'market', data: serialized });
            } else if (Date.now() - lastSentAt > 15000) {
                lastSentAt = Date.now();
                await stream.write(': ping\n\n');
            }

            await stream.sleep(2000);
        }
    });
});

investRoutes.get('/market/:ticker/history', async (c) => {
    const ticker = c.req.param('ticker');
    const limit = Math.min(Number(c.req.query('limit')) || 30, 200);

    const rows = await db
        .select()
        .from(stockPriceHistory)
        .where(eq(stockPriceHistory.ticker, ticker))
        .orderBy(desc(stockPriceHistory.recordedAt))
        .limit(limit);

    return c.json(rows.reverse());
});

const TRADE_DETAIL_RE = /^(Bought|Sold) (\d+)x (\S+) @ (\d+)$/;

// Buy/sell markers for the chart are derived from the existing
// `transactions.details` text (written by /buy and sellShares below)
// instead of a dedicated table, since it already encodes side/qty/price/ticker.
investRoutes.get('/market/:ticker/trades', async (c) => {
    const ticker = c.req.param('ticker');
    const guildId = getGuildId(c);
    const session = c.get('session');
    const limit = Math.min(Number(c.req.query('limit')) || 100, 500);

    const rows = await db
        .select({
            type: transactions.type,
            details: transactions.details,
            createdAt: transactions.createdAt,
        })
        .from(transactions)
        .where(
            and(
                eq(transactions.userId, session.discordUserId),
                eq(transactions.guildId, guildId),
                inArray(transactions.type, ['invest_buy', 'invest_sell'])
            )
        )
        .orderBy(asc(transactions.createdAt))
        .limit(limit);

    const trades = rows.flatMap((row) => {
        const match = row.details?.match(TRADE_DETAIL_RE);
        if (!match || match[3] !== ticker) return [];
        return [
            {
                side:
                    match[1] === 'Bought'
                        ? ('buy' as const)
                        : ('sell' as const),
                quantity: Number(match[2]),
                price: Number(match[4]),
                createdAt: row.createdAt,
            },
        ];
    });

    return c.json(trades);
});

investRoutes.get('/portfolio', async (c) => {
    const guildId = getGuildId(c);
    const session = c.get('session');
    const portfolio = await getPortfolioSummary(session.discordUserId, guildId);
    return c.json(portfolio);
});

async function readQuantityBody(c: { req: { json: () => Promise<unknown> } }) {
    const body = await parseJsonBody(c.req);
    if (
        !body ||
        !isNonEmptyString(body.ticker) ||
        !isPositiveInteger(body.quantity)
    )
        return null;
    return { ticker: body.ticker, quantity: body.quantity };
}

investRoutes.post('/buy', async (c) => {
    const guildId = getGuildId(c);
    const session = c.get('session');
    const discordId = session.discordUserId;

    const body = await readQuantityBody(c);
    if (!body)
        return c.json({ error: 'ticker and positive quantity required' }, 400);

    const stock = await getStock(body.ticker);
    if (!stock) return c.json({ error: 'NOT_FOUND' }, 404);

    const cost = stock.price * body.quantity;
    await ensureUser(discordId, guildId);

    let resultQuantity = body.quantity;
    let resultAvgPrice = stock.price;
    let insufficientFunds = false;

    await db.transaction(async (tx) => {
        const updated = await tx
            .update(users)
            .set({
                balance: sql`${users.balance} - ${cost}`,
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(users.discordId, discordId),
                    eq(users.guildId, guildId),
                    gte(users.balance, cost)
                )
            )
            .returning();
        if (updated.length === 0) {
            insufficientFunds = true;
            return;
        }

        const existing = await tx
            .select()
            .from(userHoldings)
            .where(
                and(
                    eq(userHoldings.discordId, discordId),
                    eq(userHoldings.guildId, guildId),
                    eq(userHoldings.ticker, body.ticker)
                )
            )
            .then((res) => res[0]);

        if (existing) {
            resultQuantity = existing.quantity + body.quantity;
            resultAvgPrice = computeAvgBuyPrice(
                existing.avgBuyPrice,
                existing.quantity,
                cost,
                resultQuantity
            );
            await tx
                .update(userHoldings)
                .set({ quantity: resultQuantity, avgBuyPrice: resultAvgPrice })
                .where(eq(userHoldings.id, existing.id));
        } else {
            await tx.insert(userHoldings).values({
                discordId,
                guildId,
                ticker: body.ticker,
                quantity: body.quantity,
                avgBuyPrice: stock.price,
            });
        }

        await logTransaction(
            discordId,
            guildId,
            'invest_buy',
            -cost,
            `Bought ${body.quantity}x ${body.ticker} @ ${stock.price}`,
            tx
        );
    });

    if (insufficientFunds) return c.json({ error: 'INSUFFICIENT_FUNDS' }, 400);

    return c.json({
        stock,
        cost,
        quantity: resultQuantity,
        avgBuyPrice: resultAvgPrice,
    });
});

async function sellShares(
    discordId: string,
    guildId: string,
    ticker: string,
    quantity: number
) {
    const stock = await getStock(ticker);
    if (!stock) return { error: 'NOT_FOUND' as const };

    const proceeds = stock.price * quantity;
    let insufficientShares = false;

    await db.transaction(async (tx) => {
        const holding = await tx
            .select()
            .from(userHoldings)
            .where(
                and(
                    eq(userHoldings.discordId, discordId),
                    eq(userHoldings.guildId, guildId),
                    eq(userHoldings.ticker, ticker)
                )
            )
            .then((res) => res[0]);
        if (!holding || holding.quantity < quantity) {
            insufficientShares = true;
            return;
        }

        const remaining = holding.quantity - quantity;
        if (remaining === 0) {
            await tx
                .delete(userHoldings)
                .where(eq(userHoldings.id, holding.id));
        } else {
            await tx
                .update(userHoldings)
                .set({ quantity: remaining })
                .where(eq(userHoldings.id, holding.id));
        }

        await tx
            .update(users)
            .set({
                balance: sql`${users.balance} + ${proceeds}`,
                updatedAt: new Date(),
            })
            .where(
                and(eq(users.discordId, discordId), eq(users.guildId, guildId))
            );

        await logTransaction(
            discordId,
            guildId,
            'invest_sell',
            proceeds,
            `Sold ${quantity}x ${ticker} @ ${stock.price}`,
            tx
        );
    });

    if (insufficientShares) return { error: 'INSUFFICIENT_SHARES' as const };
    return { stock, proceeds };
}

investRoutes.post('/sell', async (c) => {
    const guildId = getGuildId(c);
    const session = c.get('session');
    const discordId = session.discordUserId;

    const body = await readQuantityBody(c);
    if (!body)
        return c.json({ error: 'ticker and positive quantity required' }, 400);

    const result = await sellShares(
        discordId,
        guildId,
        body.ticker,
        body.quantity
    );
    if ('error' in result) {
        return c.json(
            { error: result.error },
            result.error === 'NOT_FOUND' ? 404 : 400
        );
    }
    return c.json(result);
});

investRoutes.post('/sell-all', async (c) => {
    const guildId = getGuildId(c);
    const session = c.get('session');
    const discordId = session.discordUserId;

    const body = await c.req.json<{ ticker?: string }>().catch(() => null);
    if (!body?.ticker) return c.json({ error: 'ticker is required' }, 400);

    const holding = await db
        .select()
        .from(userHoldings)
        .where(
            and(
                eq(userHoldings.discordId, discordId),
                eq(userHoldings.guildId, guildId),
                eq(userHoldings.ticker, body.ticker)
            )
        )
        .then((res) => res[0]);
    if (!holding || holding.quantity <= 0) {
        return c.json({ error: 'INSUFFICIENT_SHARES' }, 400);
    }

    const result = await sellShares(
        discordId,
        guildId,
        body.ticker,
        holding.quantity
    );
    if ('error' in result) {
        return c.json(
            { error: result.error },
            result.error === 'NOT_FOUND' ? 404 : 400
        );
    }
    return c.json({ ...result, quantity: holding.quantity });
});
