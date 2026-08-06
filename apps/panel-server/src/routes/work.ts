import { Hono } from 'hono';
import { db, users } from '@sakutina/db';
import { and, eq, sql } from 'drizzle-orm';
import {
    AVAILABLE_JOBS,
    getJob,
    getRank,
    rollSalary,
    rollExpGain,
    computeStreak,
    streakBonusFor,
    calculateLevel,
} from '@sakutina/economy';
import { requireAuth, requireGuildMember } from '../auth/middleware.js';
import { getGuildId } from '../utils/params.js';
import { ensureUser, logTransaction } from '../lib/economy.js';
import type { AppEnv } from '../types.js';

export const workRoutes = new Hono<AppEnv>();

workRoutes.use('*', requireAuth, requireGuildMember);

workRoutes.get('/', async (c) => {
    const guildId = getGuildId(c);
    const session = c.get('session');
    const user = await ensureUser(session.discordUserId, guildId);

    const job = user.currentJob ? getJob(user.currentJob) : null;
    const rank = job ? getRank(job, user.currentJobShifts) : null;
    const nextRank = job
        ? job.ranks.find((r) => r.minShifts > user.currentJobShifts)
        : undefined;

    let cooldownRemainingSeconds = 0;
    if (rank && user.workLastShift) {
        const diffSeconds =
            (Date.now() - user.workLastShift.getTime()) / 1000;
        cooldownRemainingSeconds = Math.max(
            0,
            Math.ceil(rank.cooldownSeconds - diffSeconds)
        );
    }

    return c.json({
        jobs: AVAILABLE_JOBS,
        currentJob: user.currentJob,
        jobTitle: rank ? rank.title : null,
        nextRankTitle: nextRank ? nextRank.title : null,
        shiftsUntilNextRank: nextRank
            ? nextRank.minShifts - user.currentJobShifts
            : null,
        currentJobShifts: user.currentJobShifts,
        experience: user.experience,
        shiftsDone: user.workShiftsDone,
        streak: user.workStreak,
        cooldownRemainingSeconds,
    });
});

workRoutes.post('/join', async (c) => {
    const guildId = getGuildId(c);
    const session = c.get('session');
    const discordId = session.discordUserId;

    const body = await c.req.json<{ jobId?: string }>().catch(() => null);
    const jobId = body?.jobId;
    if (!jobId) return c.json({ error: 'jobId is required' }, 400);

    const job = getJob(jobId);
    if (!job) return c.json({ error: 'Unknown job' }, 404);

    const user = await ensureUser(discordId, guildId);
    if (user.currentJob === jobId) {
        return c.json({ error: 'ALREADY_HAVE' }, 400);
    }
    if (user.experience < job.minExperience) {
        return c.json(
            {
                error: 'INSUFFICIENT_EXP',
                required: job.minExperience,
                current: user.experience,
            },
            400
        );
    }

    await db
        .update(users)
        .set({ currentJob: jobId, currentJobShifts: 0, updatedAt: new Date() })
        .where(and(eq(users.discordId, discordId), eq(users.guildId, guildId)));

    return c.json({ job });
});

workRoutes.post('/leave', async (c) => {
    const guildId = getGuildId(c);
    const session = c.get('session');
    const discordId = session.discordUserId;

    const user = await ensureUser(discordId, guildId);
    if (!user.currentJob) return c.json({ error: 'NO_JOB' }, 400);

    await db
        .update(users)
        .set({ currentJob: null, currentJobShifts: 0, updatedAt: new Date() })
        .where(and(eq(users.discordId, discordId), eq(users.guildId, guildId)));

    return c.json({ ok: true });
});

workRoutes.post('/shift', async (c) => {
    const guildId = getGuildId(c);
    const session = c.get('session');
    const discordId = session.discordUserId;

    const user = await ensureUser(discordId, guildId);
    if (!user.currentJob) return c.json({ error: 'NO_JOB' }, 400);

    const job = getJob(user.currentJob);
    if (!job) {
        await db
            .update(users)
            .set({
                currentJob: null,
                currentJobShifts: 0,
                updatedAt: new Date(),
            })
            .where(
                and(eq(users.discordId, discordId), eq(users.guildId, guildId))
            );
        return c.json({ error: 'REMOVED' }, 400);
    }

    const rank = getRank(job, user.currentJobShifts);

    const now = new Date();
    if (user.workLastShift) {
        const diffSeconds =
            (now.getTime() - user.workLastShift.getTime()) / 1000;
        if (diffSeconds < rank.cooldownSeconds) {
            const remaining = Math.ceil(rank.cooldownSeconds - diffSeconds);
            return c.json({ error: 'COOLDOWN', remaining, unit: 'seconds' }, 429);
        }
    }

    const { streak: newStreak, streakDate: streakDateToSave } = computeStreak(
        now,
        user.workStreakDate,
        user.workStreak
    );
    const streakBonus = streakBonusFor(newStreak);

    const bonusMoneyActive =
        !!user.bonusMoneyUntil && now < user.bonusMoneyUntil;
    const bonusXpActive = !!user.bonusXpUntil && now < user.bonusXpUntil;

    const baseSalary = rollSalary(rank);
    let salary = Math.round(baseSalary * (1 + streakBonus));
    if (bonusMoneyActive) salary *= 2;

    let expGain = rollExpGain();
    if (bonusXpActive) expGain *= 2;

    const newCurrentJobShifts = user.currentJobShifts + 1;
    const newRank = getRank(job, newCurrentJobShifts);
    const promoted = newRank.title !== rank.title;

    const updated = await db
        .update(users)
        .set({
            balance: sql`${users.balance} + ${salary}`,
            experience: sql`${users.experience} + ${expGain}`,
            workShiftsDone: sql`${users.workShiftsDone} + 1`,
            currentJobShifts: newCurrentJobShifts,
            workLastShift: now,
            workStreak: newStreak,
            workStreakDate: streakDateToSave,
            updatedAt: now,
        })
        .where(and(eq(users.discordId, discordId), eq(users.guildId, guildId)))
        .returning()
        .then((res) => res[0]!);

    const details = [
        `Worked as ${rank.title}`,
        bonusMoneyActive ? '2x money bonus' : null,
        bonusXpActive ? '2x xp bonus' : null,
        newStreak > 1 ? `streak x${newStreak}` : null,
    ]
        .filter(Boolean)
        .join(' — ');
    await logTransaction(discordId, guildId, 'work', salary, details);

    return c.json({
        salary,
        expGain,
        jobTitle: rank.title,
        newLevel: calculateLevel(updated.experience),
        promoted,
        newRankTitle: newRank.title,
        streak: newStreak,
        bonusMoneyActive,
        bonusXpActive,
    });
});
