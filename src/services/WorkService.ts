import { eq, sql } from "drizzle-orm";
import { db } from "../repositories/db.js";
import { users } from "../repositories/schema.js";
import { EconomyService } from "./EconomyService.js";
import { JobError, CooldownError } from "../utils/errors.js";

export interface JobInfo {
  id: string;
  title: string;
  minExperience: number;
  salaryMin: number;
  salaryMax: number;
}

export const AVAILABLE_JOBS: JobInfo[] = [
  { id: "barista", title: "Barista", minExperience: 0, salaryMin: 10, salaryMax: 30 },
  { id: "delivery", title: "Delivery Driver", minExperience: 20, salaryMin: 25, salaryMax: 50 },
  { id: "developer", title: "Developer", minExperience: 100, salaryMin: 60, salaryMax: 120 },
  { id: "ceo", title: "CEO", minExperience: 500, salaryMin: 200, salaryMax: 500 },
];

export class WorkService {
  /**
   * Cooldown for shifts in seconds (user specified 30s)
   */
  private static readonly SHIFT_COOLDOWN_SECONDS = 30;

  public static getJob(id: string): JobInfo | undefined {
    return AVAILABLE_JOBS.find((j) => j.id === id);
  }

  public static async joinJob(discordId: string, jobId: string) {
    const job = this.getJob(jobId);
    if (!job) throw new JobError("NOT_FOUND");

    const user = await EconomyService.ensureUser(discordId);

    if (user.currentJob === jobId) throw new JobError("ALREADY_HAVE");
    if (user.experience < job.minExperience) throw new JobError("INSUFFICIENT_EXP");

    await db.update(users)
      .set({ currentJob: jobId, updatedAt: new Date() })
      .where(eq(users.discordId, discordId));
    
    return job;
  }

  public static async leaveJob(discordId: string) {
    const user = await EconomyService.ensureUser(discordId);
    if (!user.currentJob) throw new JobError("NO_JOB");

    await db.update(users)
      .set({ currentJob: null, updatedAt: new Date() })
      .where(eq(users.discordId, discordId));
  }

  public static async workShift(discordId: string) {
    const user = await EconomyService.ensureUser(discordId);
    if (!user.currentJob) throw new JobError("NO_JOB");

    const job = this.getJob(user.currentJob);
    if (!job) {
      // Job no longer exists? Force leave.
      await this.leaveJob(discordId);
      throw new JobError("REMOVED");
    }

    const now = new Date();
    if (user.workLastShift) {
      const diffSeconds = (now.getTime() - user.workLastShift.getTime()) / 1000;
      if (diffSeconds < this.SHIFT_COOLDOWN_SECONDS) {
        const remaining = Math.ceil(this.SHIFT_COOLDOWN_SECONDS - diffSeconds);
        throw new CooldownError(remaining, "seconds");
      }
    }

    const salary = Math.floor(Math.random() * (job.salaryMax - job.salaryMin + 1)) + job.salaryMin;
    const expGain = Math.floor(Math.random() * 5) + 1; // 1 to 5 exp per shift

    await db.update(users)
      .set({
        balance: sql`${users.balance} + ${salary}`,
        experience: sql`${users.experience} + ${expGain}`,
        workShiftsDone: sql`${users.workShiftsDone} + 1`,
        workLastShift: now,
        updatedAt: new Date()
      })
      .where(eq(users.discordId, discordId));

    return { salary, expGain, jobTitle: job.title };
  }

  public static async getStats(discordId: string) {
    const user = await EconomyService.ensureUser(discordId);
    return {
      currentJob: user.currentJob ? this.getJob(user.currentJob)?.title ?? "Unknown" : null,
      experience: user.experience,
      shiftsDone: user.workShiftsDone,
    };
  }
}
