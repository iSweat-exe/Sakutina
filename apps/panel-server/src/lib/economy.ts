import { db, users, transactions, stocks, userHoldings } from '@sakutina/db';
import { and, eq } from 'drizzle-orm';

/** Same upsert-on-first-touch shape as EconomyService.ensureUser in apps/bot. */
export async function ensureUser(discordId: string, guildId: string) {
    const existing = await db
        .select()
        .from(users)
        .where(and(eq(users.discordId, discordId), eq(users.guildId, guildId)))
        .then((res) => res[0]);
    if (existing) return existing;

    return db
        .insert(users)
        .values({ discordId, guildId })
        .returning()
        .then((res) => res[0]!);
}

/** Mirrors EconomyService.logTransaction in apps/bot. */
export async function logTransaction(
    userId: string,
    guildId: string,
    type: string,
    amount: number,
    details?: string,
    tx?: any
) {
    const executor = tx ?? db;
    await executor.insert(transactions).values({
        userId,
        guildId,
        type,
        amount,
        details,
    });
}

/** Mirrors InvestmentService.getPortfolio in apps/bot. */
export async function getPortfolioSummary(discordId: string, guildId: string) {
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

    const allStocks = await db.select().from(stocks);
    const priceByTicker = new Map(allStocks.map((s) => [s.ticker, s.price]));

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
