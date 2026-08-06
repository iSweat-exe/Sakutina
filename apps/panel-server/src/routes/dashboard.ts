import { Hono } from 'hono';
import {
    db,
    users,
    warns,
    modActions,
    interactionStats,
    transactions,
    userHoldings,
    stocks,
} from '@sakutina/db';
import { and, count, desc, eq, gte, sum } from 'drizzle-orm';
import { requireAuth, requireGuildAccess } from '../auth/middleware.js';
import { fetchGuildMemberCount, fetchGuildMembers } from '../discord/rest.js';
import { getGuildId } from '../utils/params.js';
import type { AppEnv } from '../types.js';

export const dashboardRoutes = new Hono<AppEnv>();

dashboardRoutes.use('*', requireAuth, requireGuildAccess);

dashboardRoutes.get('/overview', async (c) => {
    const guildId = getGuildId(c);

    const [
        memberCount,
        trackedUsersRows,
        warnRows,
        actionRows,
        interactionRows,
        recentActionRows,
        topUsers,
    ] = await Promise.all([
        fetchGuildMemberCount(guildId),
        db
            .select({ trackedUsers: count() })
            .from(users)
            .where(eq(users.guildId, guildId)),
        db
            .select({ warnCount: count() })
            .from(warns)
            .where(eq(warns.guildId, guildId)),
        db
            .select({ actionCount: count() })
            .from(modActions)
            .where(eq(modActions.guildId, guildId)),
        db
            .select({ interactionsTotal: sum(interactionStats.count) })
            .from(interactionStats)
            .where(eq(interactionStats.guildId, guildId)),
        db
            .select()
            .from(modActions)
            .where(eq(modActions.guildId, guildId))
            .orderBy(desc(modActions.createdAt))
            .limit(5),
        db
            .select({
                discordId: users.discordId,
                balance: users.balance,
            })
            .from(users)
            .where(eq(users.guildId, guildId))
            .orderBy(desc(users.balance))
            .limit(3),
    ]);

    const memberIds = [
        ...recentActionRows.map((a) => a.userId),
        ...topUsers.map((u) => u.discordId),
    ];
    const members = await fetchGuildMembers(guildId, memberIds);

    return c.json({
        memberCount,
        trackedUsers: trackedUsersRows[0]?.trackedUsers ?? 0,
        warnCount: warnRows[0]?.warnCount ?? 0,
        actionCount: actionRows[0]?.actionCount ?? 0,
        interactionsTotal: Number(interactionRows[0]?.interactionsTotal ?? 0),
        recentActions: recentActionRows.map((action) => ({
            ...action,
            member: members.get(action.userId) ?? null,
        })),
        topUsers: topUsers.map((u) => ({
            ...u,
            member: members.get(u.discordId) ?? null,
        })),
    });
});

const TRANSACTION_HISTORY_MS = 7 * 24 * 60 * 60 * 1000;
const TRANSACTION_ROW_LIMIT = 5000;
const TOP_TRANSACTION_TYPES = 6;

dashboardRoutes.get('/economy', async (c) => {
    const guildId = getGuildId(c);
    const since = new Date(Date.now() - TRANSACTION_HISTORY_MS);

    const [wealthRow, trackedUsersRows, holdingRows, recentTransactions] =
        await Promise.all([
            db
                .select({
                    totalWallet: sum(users.balance),
                    totalBank: sum(users.bank),
                })
                .from(users)
                .where(eq(users.guildId, guildId)),
            db
                .select({ trackedUsers: count() })
                .from(users)
                .where(eq(users.guildId, guildId)),
            db
                .select({
                    quantity: userHoldings.quantity,
                    price: stocks.price,
                })
                .from(userHoldings)
                .innerJoin(stocks, eq(userHoldings.ticker, stocks.ticker))
                .where(eq(userHoldings.guildId, guildId)),
            db
                .select({
                    type: transactions.type,
                    amount: transactions.amount,
                })
                .from(transactions)
                .where(
                    and(
                        eq(transactions.guildId, guildId),
                        gte(transactions.createdAt, since)
                    )
                )
                .limit(TRANSACTION_ROW_LIMIT),
        ]);

    const totalWallet = Number(wealthRow[0]?.totalWallet ?? 0);
    const totalBank = Number(wealthRow[0]?.totalBank ?? 0);
    const trackedUsers = trackedUsersRows[0]?.trackedUsers ?? 0;
    const totalPortfolioValue = holdingRows.reduce(
        (sum, h) => sum + h.quantity * h.price,
        0
    );
    const totalWealth = totalWallet + totalBank + totalPortfolioValue;

    let totalEarned = 0;
    let totalSpent = 0;
    const byType = new Map<string, number>();
    for (const tx of recentTransactions) {
        if (tx.amount >= 0) totalEarned += tx.amount;
        else totalSpent += -tx.amount;
        byType.set(tx.type, (byType.get(tx.type) ?? 0) + Math.abs(tx.amount));
    }
    const transactionsByType = [...byType.entries()]
        .map(([type, volume]) => ({ type, volume }))
        .sort((a, b) => b.volume - a.volume)
        .slice(0, TOP_TRANSACTION_TYPES);

    return c.json({
        totalWallet,
        totalBank,
        totalPortfolioValue,
        totalWealth,
        avgWealth: trackedUsers > 0 ? Math.round(totalWealth / trackedUsers) : 0,
        transactionCount7d: recentTransactions.length,
        totalEarned7d: totalEarned,
        totalSpent7d: totalSpent,
        transactionsByType,
    });
});
