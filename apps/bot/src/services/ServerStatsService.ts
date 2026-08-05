import { eq, sql } from 'drizzle-orm';
import { db, users, warns, modActions, transactions } from '@sakutina/db';

export class ServerStatsService {
    public static async getStats(guildId: string) {
        const [economyAgg] = await db
            .select({
                trackedUsers: sql<number>`count(*)`,
                totalWealth: sql<number>`coalesce(sum(${users.balance} + ${users.bank}), 0)`,
                avgWealth: sql<number>`coalesce(avg(${users.balance} + ${users.bank}), 0)`,
            })
            .from(users)
            .where(eq(users.guildId, guildId));

        const [warnAgg] = await db
            .select({ count: sql<number>`count(*)` })
            .from(warns)
            .where(eq(warns.guildId, guildId));

        const [modAgg] = await db
            .select({ count: sql<number>`count(*)` })
            .from(modActions)
            .where(eq(modActions.guildId, guildId));

        const [txAgg] = await db
            .select({ count: sql<number>`count(*)` })
            .from(transactions)
            .where(eq(transactions.guildId, guildId));

        return {
            trackedUsers: Number(economyAgg?.trackedUsers ?? 0),
            totalWealth: Number(economyAgg?.totalWealth ?? 0),
            avgWealth: Math.round(Number(economyAgg?.avgWealth ?? 0)),
            totalWarns: Number(warnAgg?.count ?? 0),
            totalModActions: Number(modAgg?.count ?? 0),
            totalTransactions: Number(txAgg?.count ?? 0),
        };
    }
}
