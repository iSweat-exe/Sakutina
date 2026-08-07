import { eq, sql, and, isNull } from 'drizzle-orm';
import { db, users } from '@sakutina/db';
import { EconomyService } from './EconomyService.js';
import { JobError, CooldownError } from '../utils/errors.js';
import { calculateLevel } from '../utils/leveling.js';
import {
    getJob,
    getRank,
    rollSalary,
    rollExpGain,
    computeStreak,
    streakBonusFor,
} from '@sakutina/economy';
import type { JobInfo, JobRank } from '../modules/economy/types.js';

export class WorkService {
    public static getJob(id: string): JobInfo | undefined {
        return getJob(id);
    }

    /**
     * Resolves the highest rank a user has unlocked in a job, based on
     * how many shifts they've worked in that specific job.
     */
    public static getRank(job: JobInfo, currentJobShifts: number): JobRank {
        return getRank(job, currentJobShifts);
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
        const { streak: newStreak, streakDate: streakDateToSave } =
            computeStreak(now, user.workStreakDate, user.workStreak);
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
        const newRank = this.getRank(job, newCurrentJobShifts);
        const promoted = newRank.title !== rank.title;

        // Optimistic lock: only apply if workLastShift still matches what we
        // read above. A concurrent shift that wins the race changes it first,
        // so this UPDATE affects 0 rows and we reject instead of double-paying.
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
                and(
                    eq(users.discordId, discordId),
                    eq(users.guildId, guildId),
                    user.workLastShift
                        ? eq(users.workLastShift, user.workLastShift)
                        : isNull(users.workLastShift)
                )
            )
            .returning()
            .then((res) => res[0]);
        if (!updated) {
            throw new CooldownError(
                'WORK_ERR_COOLDOWN',
                rank.cooldownSeconds,
                'seconds'
            );
        }

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
