import { eq, sql, and } from 'drizzle-orm';
import { db, users } from '@sakutina/db';
import { EconomyService } from './EconomyService.js';
import { JobError, CooldownError } from '../utils/errors.js';
import { calculateLevel } from '../utils/leveling.js';
import {
    AVAILABLE_JOBS,
    STREAK_BONUS_PER_DAY,
    STREAK_BONUS_CAP,
} from '../modules/economy/constants.js';
import type { JobInfo, JobRank } from '../modules/economy/types.js';

function toUtcDate(date: Date): Date {
    return new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
    );
}

export class WorkService {
    public static getJob(id: string): JobInfo | undefined {
        return AVAILABLE_JOBS.find((j) => j.id === id);
    }

    /**
     * Resolves the highest rank a user has unlocked in a job, based on
     * how many shifts they've worked in that specific job.
     */
    public static getRank(job: JobInfo, currentJobShifts: number): JobRank {
        let rank = job.ranks[0]!;
        for (const r of job.ranks) {
            if (currentJobShifts >= r.minShifts) rank = r;
        }
        return rank;
    }

    public static async joinJob(
        discordId: string,
        guildId: string,
        jobId: string
    ) {
        const job = this.getJob(jobId);
        if (!job) throw new JobError('NOT_FOUND');

        const user = await EconomyService.ensureUser(discordId, guildId);

        if (user.currentJob === jobId) throw new JobError('ALREADY_HAVE');
        if (user.experience < job.minExperience)
            throw new JobError('INSUFFICIENT_EXP', {
                required: job.minExperience,
                current: user.experience,
            });

        await db
            .update(users)
            .set({
                currentJob: jobId,
                currentJobShifts: 0,
                updatedAt: new Date(),
            })
            .where(
                and(eq(users.discordId, discordId), eq(users.guildId, guildId))
            );

        return job;
    }

    public static async leaveJob(discordId: string, guildId: string) {
        const user = await EconomyService.ensureUser(discordId, guildId);
        if (!user.currentJob) throw new JobError('NO_JOB');

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
    }

    public static async workShift(discordId: string, guildId: string) {
        const user = await EconomyService.ensureUser(discordId, guildId);
        if (!user.currentJob) throw new JobError('NO_JOB');

        const job = this.getJob(user.currentJob);
        if (!job) {
            // Job no longer exists? Force leave.
            await this.leaveJob(discordId, guildId);
            throw new JobError('REMOVED');
        }

        const rank = this.getRank(job, user.currentJobShifts);

        const now = new Date();
        if (user.workLastShift) {
            const diffSeconds =
                (now.getTime() - user.workLastShift.getTime()) / 1000;
            if (diffSeconds < rank.cooldownSeconds) {
                const remaining = Math.ceil(rank.cooldownSeconds - diffSeconds);
                throw new CooldownError(
                    'WORK_ERR_COOLDOWN',
                    remaining,
                    'seconds'
                );
            }
        }

        // Daily streak: one credit per calendar day (UTC), regardless of
        // how many shifts are worked that day.
        const today = toUtcDate(now);
        let newStreak = user.workStreak;
        let streakDateToSave = user.workStreakDate;
        if (!user.workStreakDate) {
            newStreak = 1;
            streakDateToSave = today;
        } else {
            const savedDate = toUtcDate(user.workStreakDate);
            const diffDays = Math.round(
                (today.getTime() - savedDate.getTime()) / 86400000
            );
            if (diffDays === 1) {
                newStreak = user.workStreak + 1;
                streakDateToSave = today;
            } else if (diffDays > 1) {
                newStreak = 1;
                streakDateToSave = today;
            }
            // diffDays === 0: already credited today, streak unchanged.
        }
        const streakBonus = Math.min(
            newStreak * STREAK_BONUS_PER_DAY,
            STREAK_BONUS_CAP
        );

        const bonusMoneyActive =
            !!user.bonusMoneyUntil && now < user.bonusMoneyUntil;
        const bonusXpActive = !!user.bonusXpUntil && now < user.bonusXpUntil;

        const baseSalary =
            Math.floor(Math.random() * (rank.salaryMax - rank.salaryMin + 1)) +
            rank.salaryMin;
        let salary = Math.round(baseSalary * (1 + streakBonus));
        if (bonusMoneyActive) salary *= 2;

        let expGain = Math.floor(Math.random() * 5) + 1; // 1 to 5 exp per shift
        if (bonusXpActive) expGain *= 2;

        const newCurrentJobShifts = user.currentJobShifts + 1;
        const newRank = this.getRank(job, newCurrentJobShifts);
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
            .where(
                and(eq(users.discordId, discordId), eq(users.guildId, guildId))
            )
            .returning()
            .then((res) => res[0]);
        if (!updated)
            throw new Error('User unexpectedly disappeared during update');

        const details = [
            `Worked as ${rank.title}`,
            bonusMoneyActive ? '2x money bonus' : null,
            bonusXpActive ? '2x xp bonus' : null,
            newStreak > 1 ? `streak x${newStreak}` : null,
        ]
            .filter(Boolean)
            .join(' â€” ');
        await EconomyService.logTransaction(
            discordId,
            guildId,
            'work',
            salary,
            details
        );

        return {
            salary,
            expGain,
            jobTitle: rank.title,
            newLevel: calculateLevel(updated.experience),
            promoted,
            newRankTitle: newRank.title,
            streak: newStreak,
            bonusMoneyActive,
            bonusXpActive,
        };
    }

    public static async getStats(discordId: string, guildId: string) {
        const user = await EconomyService.ensureUser(discordId, guildId);
        const job = user.currentJob ? this.getJob(user.currentJob) : undefined;
        const rank = job ? this.getRank(job, user.currentJobShifts) : null;
        const nextRank = job
            ? job.ranks.find((r) => r.minShifts > user.currentJobShifts)
            : undefined;

        return {
            currentJob: rank ? rank.title : null,
            currentJobShifts: user.currentJobShifts,
            nextRankTitle: nextRank ? nextRank.title : null,
            shiftsUntilNextRank: nextRank
                ? nextRank.minShifts - user.currentJobShifts
                : null,
            experience: user.experience,
            shiftsDone: user.workShiftsDone,
            streak: user.workStreak,
        };
    }
}
