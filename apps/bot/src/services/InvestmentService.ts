import { and, desc, eq, gte, sql } from 'drizzle-orm';
import {
    db,
    stocks,
    userHoldings,
    stockPriceHistory,
    users,
} from '@sakutina/db';
import { EconomyService } from './EconomyService.js';
import { InsufficientFundsError, InvestError } from '@/utils/errors.js';
import { STOCK_LIST } from '@/modules/economy/stocks.js';

export class InvestmentService {
    /** Idempotent seed run at startup; existing tickers are left untouched. */
    public static async ensureStocksSeeded() {
        for (const stock of STOCK_LIST) {
            await db
                .insert(stocks)
                .values({
                    ticker: stock.ticker,
                    name: stock.name,
                    price: stock.basePrice,
                    previousPrice: stock.basePrice,
                })
                .onConflictDoNothing();
        }
    }

    public static async getAllStocks() {
        return db.select().from(stocks).orderBy(stocks.ticker);
    }

    public static async getStock(ticker: string) {
        const stock = await db
            .select()
            .from(stocks)
            .where(eq(stocks.ticker, ticker))
            .then((res) => res[0]);
        if (!stock) throw new InvestError('NOT_FOUND');
        return stock;
    }

    public static async getPriceHistory(ticker: string, limit = 30) {
        const rows = await db
            .select()
            .from(stockPriceHistory)
            .where(eq(stockPriceHistory.ticker, ticker))
            .orderBy(desc(stockPriceHistory.recordedAt))
            .limit(limit);
        return rows.reverse();
    }

    /**
     * Buy shares. The balance deduction is a CAS update (`WHERE balance >=
     * cost`) so concurrent buys can't overdraw the wallet.
     */
    public static async buy(
        discordId: string,
        guildId: string,
        ticker: string,
        quantity: number
    ) {
        const stock = await this.getStock(ticker);
        const cost = stock.price * quantity;

        await EconomyService.ensureUser(discordId, guildId);

        let resultQuantity = quantity;
        let resultAvgPrice = stock.price;

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
            if (updated.length === 0) throw new InsufficientFundsError();

            const existing = await tx
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

            if (existing) {
                resultQuantity = existing.quantity + quantity;
                resultAvgPrice = Math.round(
                    (existing.avgBuyPrice * existing.quantity + cost) /
                        resultQuantity
                );
                await tx
                    .update(userHoldings)
                    .set({
                        quantity: resultQuantity,
                        avgBuyPrice: resultAvgPrice,
                    })
                    .where(eq(userHoldings.id, existing.id));
            } else {
                await tx.insert(userHoldings).values({
                    discordId,
                    guildId,
                    ticker,
                    quantity,
                    avgBuyPrice: stock.price,
                });
            }

            await EconomyService.logTransaction(
                discordId,
                guildId,
                'invest_buy',
                -cost,
                `Bought ${quantity}x ${ticker} @ ${stock.price}`,
                tx
            );
        });

        return {
            stock,
            cost,
            quantity: resultQuantity,
            avgBuyPrice: resultAvgPrice,
        };
    }

    /**
     * Sell shares. The quantity check + update happen inside a transaction
     * so concurrent sells can't oversell a holding.
     */
    public static async sell(
        discordId: string,
        guildId: string,
        ticker: string,
        quantity: number
    ) {
        const stock = await this.getStock(ticker);
        const proceeds = stock.price * quantity;

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
                throw new InvestError('INSUFFICIENT_SHARES');
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
                    and(
                        eq(users.discordId, discordId),
                        eq(users.guildId, guildId)
                    )
                );

            await EconomyService.logTransaction(
                discordId,
                guildId,
                'invest_sell',
                proceeds,
                `Sold ${quantity}x ${ticker} @ ${stock.price}`,
                tx
            );
        });

        return { stock, proceeds };
    }

    /** Sells a user's entire holding of a ticker in one go. */
    public static async sellAll(
        discordId: string,
        guildId: string,
        ticker: string
    ) {
        const holding = await db
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
        if (!holding || holding.quantity <= 0) {
            throw new InvestError('INSUFFICIENT_SHARES');
        }

        const result = await this.sell(
            discordId,
            guildId,
            ticker,
            holding.quantity
        );
        return { ...result, quantity: holding.quantity };
    }

    public static async getPortfolio(discordId: string, guildId: string) {
        const holdings = await db
            .select()
            .from(userHoldings)
            .where(
                and(
                    eq(userHoldings.discordId, discordId),
                    eq(userHoldings.guildId, guildId)
                )
            );
        if (holdings.length === 0) return [];

        const allStocks = await this.getAllStocks();
        const priceByTicker = new Map(
            allStocks.map((s) => [s.ticker, s.price])
        );

        return holdings.map((h) => {
            const currentPrice = priceByTicker.get(h.ticker) ?? h.avgBuyPrice;
            return {
                ...h,
                currentPrice,
                currentValue: currentPrice * h.quantity,
                profitLoss: (currentPrice - h.avgBuyPrice) * h.quantity,
            };
        });
    }

    /**
     * Mean-reverting bounded random walk, run on every StockPriceJob tick.
     * `next = max(1, price + (basePrice-price)*0.05 + price*(rand*2-1)*volatility)`
     * — the reversion term keeps prices from drifting away forever, the
     * clamp keeps them from ever hitting zero.
     */
    public static async tickAllPrices() {
        const allStocks = await this.getAllStocks();
        for (const stock of allStocks) {
            const info = STOCK_LIST.find((s) => s.ticker === stock.ticker);
            const base = info?.basePrice ?? stock.price;
            const volatility = info?.volatility ?? 0.05;

            const reversion = (base - stock.price) * 0.05;
            const noise = stock.price * (Math.random() * 2 - 1) * volatility;
            const nextPrice = Math.max(
                1,
                Math.round(stock.price + reversion + noise)
            );

            await db
                .update(stocks)
                .set({
                    price: nextPrice,
                    previousPrice: stock.price,
                    updatedAt: new Date(),
                })
                .where(eq(stocks.id, stock.id));

            await db.insert(stockPriceHistory).values({
                ticker: stock.ticker,
                price: nextPrice,
            });
        }
    }
}
