import { eq, sql, and } from 'drizzle-orm';
import { db } from '../repositories/db.js';
import { users } from '../repositories/schema.js';
import { EconomyService } from './EconomyService.js';
import { JobError, CooldownError } from '../utils/errors.js';
import {
    AVAILABLE_JOBS,
    SHIFT_COOLDOWN_SECONDS,
} from '../modules/economy/constants.js';
import type { JobInfo } from '../modules/economy/types.js';

export class WorkService {
    public static getJob(id: string): JobInfo | undefined {
        return AVAILABLE_JOBS.find((j) => j.id === id);
    }

    public static async joinJob(discordId: string, guildId: string, jobId: string) {
        const job = this.getJob(jobId);
        if (!job) throw new JobError('NOT_FOUND');

        const user = await EconomyService.ensureUser(discordId, guildId);

        if (user.currentJob === jobId) throw new JobError('ALREADY_HAVE');
        if (user.experience < job.minExperience)
            throw new JobError('INSUFFICIENT_EXP');

        await db
            .update(users)
            .set({ currentJob: jobId, updatedAt: new Date() })
            .where(and(eq(users.discordId, discordId), eq(users.guildId, guildId)));

        return job;
    }

    public static async leaveJob(discordId: string, guildId: string) {
        const user = await EconomyService.ensureUser(discordId, guildId);
        if (!user.currentJob) throw new JobError('NO_JOB');

        await db
            .update(users)
            .set({ currentJob: null, updatedAt: new Date() })
            .where(and(eq(users.discordId, discordId), eq(users.guildId, guildId)));
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

        const now = new Date();
        if (user.workLastShift) {
            const diffSeconds =
                (now.getTime() - user.workLastShift.getTime()) / 1000;
            if (diffSeconds < SHIFT_COOLDOWN_SECONDS) {
                const remaining = Math.ceil(
                    SHIFT_COOLDOWN_SECONDS - diffSeconds
                );
                throw new CooldownError('WORK_ERR_COOLDOWN', remaining, 'seconds');
            }
        }

        const salary =
            Math.floor(Math.random() * (job.salaryMax - job.salaryMin + 1)) +
            job.salaryMin;
        const expGain = Math.floor(Math.random() * 5) + 1; // 1 to 5 exp per shift

        await db
            .update(users)
            .set({
                balance: sql`${users.balance} + ${salary}`,
                experience: sql`${users.experience} + ${expGain}`,
                workShiftsDone: sql`${users.workShiftsDone} + 1`,
                workLastShift: now,
                updatedAt: new Date(),
            })
            .where(and(eq(users.discordId, discordId), eq(users.guildId, guildId)));

        await EconomyService.logTransaction(discordId, guildId, 'work', salary, `Worked as ${job.title}`);

        return { salary, expGain, jobTitle: job.title };
    }

    public static async getStats(discordId: string, guildId: string) {
        const user = await EconomyService.ensureUser(discordId, guildId);
        return {
            currentJob: user.currentJob
                ? (this.getJob(user.currentJob)?.title ?? 'Unknown')
                : null,
            experience: user.experience,
            shiftsDone: user.workShiftsDone,
        };
    }
}
