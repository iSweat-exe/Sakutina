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
import { and, count, desc, eq, gte, sql, sum } from 'drizzle-orm';
import {
    DEFAULT_PARAMS,
    buildReportBody,
    runSimulation,
    type SimulationParams,
} from '@sakutina/economy/simulation';
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
                balance: sql<number>`${users.balance} + ${users.bank}`.as(
                    'balance'
                ),
            })
            .from(users)
            .where(eq(users.guildId, guildId))
            .orderBy(desc(sql`${users.balance} + ${users.bank}`))
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
        avgWealth:
            trackedUsers > 0 ? Math.round(totalWealth / trackedUsers) : 0,
        transactionCount7d: recentTransactions.length,
        totalEarned7d: totalEarned,
        totalSpent7d: totalSpent,
        transactionsByType,
    });
});

const SIMULATION_PARAMS_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const SIMULATION_PARAMS_ROW_LIMIT = 20_000;

interface DayBucket {
    activeUsers: Set<string>;
    dailyClaimUsers: Set<string>;
    workCount: number;
    casinoUsers: Set<string>;
    casinoCount: number;
    casinoAmountAbs: number;
    depositAmount: number;
    robCount: number;
}

function emptyDayBucket(): DayBucket {
    return {
        activeUsers: new Set(),
        dailyClaimUsers: new Set(),
        workCount: 0,
        casinoUsers: new Set(),
        casinoCount: 0,
        casinoAmountAbs: 0,
        depositAmount: 0,
        robCount: 0,
    };
}

function average(buckets: DayBucket[], pick: (d: DayBucket) => number) {
    if (buckets.length === 0) return 0;
    return buckets.reduce((sum, d) => sum + pick(d), 0) / buckets.length;
}

/**
 * avgBetFraction/depositRate divide a window-cumulative amount by the
 * guild's *current* average balance snapshot, which is a noisy denominator
 * on small/sparse samples (few tracked users, few active days) and can push
 * the ratio past 1. Clamp to [0, 1] since these are meant to be fractions.
 */
function clampRate(value: number): number {
    return Math.min(1, Math.max(0, value));
}

interface SimulationCalibration {
    trackedUsers: number;
    windowDays: number;
    sampleSize: number;
    activeDaysObserved: number;
    activeFraction: number;
    dailyClaimRate: number;
    avgWorkShiftsPerActiveDay: number;
    casinoParticipationRate: number;
    avgCasinoBetsPerActivePlayer: number;
    avgBetFraction: number;
    depositRate: number;
    robAttemptRate: number;
}

/**
 * Derives the economy simulator's behavioral parameters (see
 * packages/economy/src/simulation/params.ts) from this guild's real
 * transaction history, so DEFAULT_PARAMS can be checked against — or
 * replaced by — this server's actual player behavior. Shared by the
 * `/simulation-params` (display) and `/simulate` (run) routes.
 */
async function computeSimulationCalibration(
    guildId: string
): Promise<SimulationCalibration> {
    const since = new Date(Date.now() - SIMULATION_PARAMS_WINDOW_MS);

    const [trackedUsersRows, wealthRow, txRows] = await Promise.all([
        db
            .select({ trackedUsers: count() })
            .from(users)
            .where(eq(users.guildId, guildId)),
        db
            .select({ totalWallet: sum(users.balance) })
            .from(users)
            .where(eq(users.guildId, guildId)),
        db
            .select({
                userId: transactions.userId,
                type: transactions.type,
                amount: transactions.amount,
                createdAt: transactions.createdAt,
            })
            .from(transactions)
            .where(
                and(
                    eq(transactions.guildId, guildId),
                    gte(transactions.createdAt, since)
                )
            )
            .limit(SIMULATION_PARAMS_ROW_LIMIT),
    ]);

    const trackedUsers = trackedUsersRows[0]?.trackedUsers ?? 0;
    const totalWallet = Number(wealthRow[0]?.totalWallet ?? 0);
    const avgBalance = trackedUsers > 0 ? totalWallet / trackedUsers : 0;

    const dayBuckets = new Map<string, DayBucket>();
    for (const tx of txRows) {
        const dayKey = tx.createdAt.toISOString().slice(0, 10);
        const bucket = dayBuckets.get(dayKey) ?? emptyDayBucket();
        dayBuckets.set(dayKey, bucket);

        bucket.activeUsers.add(tx.userId);
        switch (tx.type) {
            case 'daily':
                bucket.dailyClaimUsers.add(tx.userId);
                break;
            case 'work':
                bucket.workCount++;
                break;
            case 'casino':
                bucket.casinoUsers.add(tx.userId);
                bucket.casinoCount++;
                bucket.casinoAmountAbs += Math.abs(tx.amount);
                break;
            case 'bank_deposit':
                bucket.depositAmount += tx.amount;
                break;
            case 'rob':
                bucket.robCount++;
                break;
        }
    }

    const days = [...dayBuckets.values()];
    const avgActiveUsers = average(days, (d) => d.activeUsers.size);
    const avgDailyClaimUsers = average(days, (d) => d.dailyClaimUsers.size);
    const avgWorkCount = average(days, (d) => d.workCount);
    const avgCasinoUsers = average(days, (d) => d.casinoUsers.size);
    const avgCasinoCount = average(days, (d) => d.casinoCount);
    const avgCasinoAmountAbs = average(days, (d) => d.casinoAmountAbs);
    const avgDepositAmount = average(days, (d) => d.depositAmount);
    const avgRobCount = average(days, (d) => d.robCount);
    const avgBetSize =
        avgCasinoCount > 0 ? avgCasinoAmountAbs / avgCasinoCount : 0;

    return {
        trackedUsers,
        windowDays: SIMULATION_PARAMS_WINDOW_MS / (24 * 60 * 60 * 1000),
        sampleSize: txRows.length,
        activeDaysObserved: days.length,
        activeFraction: clampRate(
            trackedUsers > 0 ? avgActiveUsers / trackedUsers : 0
        ),
        dailyClaimRate: clampRate(
            avgActiveUsers > 0 ? avgDailyClaimUsers / avgActiveUsers : 0
        ),
        avgWorkShiftsPerActiveDay:
            avgActiveUsers > 0 ? avgWorkCount / avgActiveUsers : 0,
        casinoParticipationRate: clampRate(
            avgActiveUsers > 0 ? avgCasinoUsers / avgActiveUsers : 0
        ),
        avgCasinoBetsPerActivePlayer:
            avgCasinoUsers > 0 ? avgCasinoCount / avgCasinoUsers : 0,
        avgBetFraction: clampRate(avgBalance > 0 ? avgBetSize / avgBalance : 0),
        depositRate: clampRate(
            avgActiveUsers > 0 && avgBalance > 0
                ? avgDepositAmount / avgActiveUsers / avgBalance
                : 0
        ),
        robAttemptRate: clampRate(
            avgActiveUsers > 0 ? avgRobCount / avgActiveUsers : 0
        ),
    };
}

dashboardRoutes.get('/simulation-params', async (c) => {
    const guildId = getGuildId(c);
    const calibration = await computeSimulationCalibration(guildId);
    return c.json(calibration);
});

const SIMULATE_MIN_DAYS = 1;
const SIMULATE_MAX_DAYS = 180;
const SIMULATE_MIN_PLAYERS = 10;
const SIMULATE_MAX_PLAYERS = 1000;

/**
 * Runs the economy simulator (packages/economy/src/simulation) for this
 * guild, seeded with real behavioral stats from computeSimulationCalibration
 * wherever data exists, falling back to DEFAULT_PARAMS for anything
 * unmeasured (marriage rate, shop/stock behavior, job/casino weights, ...).
 */
dashboardRoutes.post('/simulate', async (c) => {
    const guildId = getGuildId(c);
    const body = await c.req.json<{ days?: number }>().catch(() => null);
    const requestedDays = body?.days;
    if (typeof requestedDays !== 'number' || !Number.isFinite(requestedDays)) {
        return c.json({ error: 'Invalid days' }, 400);
    }
    const days = Math.round(
        Math.min(SIMULATE_MAX_DAYS, Math.max(SIMULATE_MIN_DAYS, requestedDays))
    );

    const calibration = await computeSimulationCalibration(guildId);
    const playerCount = Math.round(
        Math.min(
            SIMULATE_MAX_PLAYERS,
            Math.max(
                SIMULATE_MIN_PLAYERS,
                calibration.trackedUsers || DEFAULT_PARAMS.playerCount
            )
        )
    );

    // A real measured rate of exactly 0 (e.g. no robs in the observed window)
    // is a legitimate calibration result, not "unmeasured" — only fall back
    // to DEFAULT_PARAMS wholesale when there's no transaction data at all to
    // calibrate from, so `|| default` doesn't silently override a true zero.
    const hasCalibrationData = calibration.activeDaysObserved > 0;

    const params: SimulationParams = {
        ...DEFAULT_PARAMS,
        playerCount,
        days,
        ...(hasCalibrationData
            ? {
                  activeFraction: calibration.activeFraction,
                  dailyClaimRate: calibration.dailyClaimRate,
                  avgWorkShiftsPerActiveDay:
                      calibration.avgWorkShiftsPerActiveDay,
                  casinoParticipationRate: calibration.casinoParticipationRate,
                  avgCasinoBetsPerActivePlayer:
                      calibration.avgCasinoBetsPerActivePlayer,
                  avgBetFraction: calibration.avgBetFraction,
                  depositRate: calibration.depositRate,
                  robAttemptRate: calibration.robAttemptRate,
              }
            : {}),
    };

    const series = runSimulation(params);
    const reportHtml = buildReportBody(series, params);

    return c.json({ params, reportHtml });
});
