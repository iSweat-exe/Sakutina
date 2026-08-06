import { Hono } from 'hono';
import { db, marriages } from '@sakutina/db';
import { eq, or } from 'drizzle-orm';
import {
    getJob,
    getRank,
    getShopItem,
    calculateLevel,
} from '@sakutina/economy';
import { requireAuth, requireGuildMember } from '../auth/middleware.js';
import { fetchGuildMember } from '../discord/rest.js';
import { getGuildId } from '../utils/params.js';
import { ensureUser, getPortfolioSummary } from '../lib/economy.js';
import type { AppEnv } from '../types.js';

export const profileRoutes = new Hono<AppEnv>();

profileRoutes.use('*', requireAuth, requireGuildMember);

profileRoutes.get('/', async (c) => {
    const guildId = getGuildId(c);
    const session = c.get('session');
    const discordId = session.discordUserId;

    const user = await ensureUser(discordId, guildId);

    const level = calculateLevel(user.experience);
    const job = user.currentJob ? getJob(user.currentJob) : null;
    const rank = job ? getRank(job, user.currentJobShifts) : null;
    const equippedItem = user.equippedTitle
        ? getShopItem(user.equippedTitle)
        : undefined;

    const [marriage, portfolio] = await Promise.all([
        db
            .select()
            .from(marriages)
            .where(
                or(
                    eq(marriages.user1Id, discordId),
                    eq(marriages.user2Id, discordId)
                )
            )
            .then((res) => res[0] ?? null),
        getPortfolioSummary(discordId, guildId),
    ]);

    let winRate = 0;
    if (user.casinoGamesPlayed > 0) {
        winRate = Math.round((user.casinoWins / user.casinoGamesPlayed) * 100);
    }

    const portfolioValue = portfolio.reduce(
        (sum, h) => sum + h.currentValue,
        0
    );

    const spouseId = marriage
        ? marriage.user1Id === discordId
            ? marriage.user2Id
            : marriage.user1Id
        : null;
    const spouse = spouseId ? await fetchGuildMember(guildId, spouseId) : null;

    return c.json({
        id: user.discordId,
        createdAt: user.createdAt,
        experience: user.experience,
        level,
        title: equippedItem ? equippedItem.name : null,
        marriedTo: spouseId
            ? { id: spouseId, displayName: spouse?.displayName ?? spouseId }
            : null,
        economy: {
            balance: user.balance,
            bank: user.bank,
            total: user.balance + user.bank,
        },
        work: {
            jobTitle: rank ? rank.title : 'Unemployed',
            shiftsDone: user.workShiftsDone,
            streak: user.workStreak,
        },
        casino: {
            gamesPlayed: user.casinoGamesPlayed,
            wins: user.casinoWins,
            losses: user.casinoLosses,
            winRate,
        },
        portfolioValue,
        netWorth: user.balance + user.bank + portfolioValue,
    });
});
