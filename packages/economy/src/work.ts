export interface JobRank {
    title: string;
    minShifts: number;
    salaryMin: number;
    salaryMax: number;
    cooldownSeconds: number;
}

export interface JobInfo {
    id: string;
    minExperience: number;
    ranks: JobRank[];
}

/** Shift count thresholds shared by every job's 3 internal ranks. */
const RANK_THRESHOLDS = [0, 15, 40] as const;
/** Cooldown (seconds) per rank tier — higher ranks work a bit faster. */
const RANK_COOLDOWNS = [300, 240, 195] as const;

/** Salary bonus granted per consecutive day worked, capped at STREAK_BONUS_CAP. */
export const STREAK_BONUS_PER_DAY = 0.02;
/** Maximum streak salary bonus (30%). */
export const STREAK_BONUS_CAP = 0.3;

/** All available jobs, each with 3 internal ranks unlocked by seniority. */
export const AVAILABLE_JOBS: JobInfo[] = [
    {
        id: 'barista',
        minExperience: 0,
        ranks: [
            { title: 'Barista', salaryMin: 10, salaryMax: 30 },
            { title: 'Senior Barista', salaryMin: 18, salaryMax: 38 },
            { title: 'Shift Manager', salaryMin: 28, salaryMax: 50 },
        ].map((r, i) => ({
            ...r,
            minShifts: RANK_THRESHOLDS[i]!,
            cooldownSeconds: RANK_COOLDOWNS[i]!,
        })),
    },
    {
        id: 'cashier',
        minExperience: 0,
        ranks: [
            { title: 'Cashier', salaryMin: 12, salaryMax: 28 },
            { title: 'Head Cashier', salaryMin: 20, salaryMax: 36 },
            { title: 'Store Supervisor', salaryMin: 30, salaryMax: 48 },
        ].map((r, i) => ({
            ...r,
            minShifts: RANK_THRESHOLDS[i]!,
            cooldownSeconds: RANK_COOLDOWNS[i]!,
        })),
    },
    {
        id: 'delivery',
        minExperience: 20,
        ranks: [
            { title: 'Delivery Driver', salaryMin: 25, salaryMax: 50 },
            { title: 'Senior Driver', salaryMin: 38, salaryMax: 65 },
            { title: 'Dispatch Lead', salaryMin: 55, salaryMax: 90 },
        ].map((r, i) => ({
            ...r,
            minShifts: RANK_THRESHOLDS[i]!,
            cooldownSeconds: RANK_COOLDOWNS[i]!,
        })),
    },
    {
        id: 'chef',
        minExperience: 50,
        ranks: [
            { title: 'Line Cook', salaryMin: 35, salaryMax: 65 },
            { title: 'Sous Chef', salaryMin: 52, salaryMax: 90 },
            { title: 'Head Chef', salaryMin: 75, salaryMax: 125 },
        ].map((r, i) => ({
            ...r,
            minShifts: RANK_THRESHOLDS[i]!,
            cooldownSeconds: RANK_COOLDOWNS[i]!,
        })),
    },
    {
        id: 'developer',
        minExperience: 100,
        ranks: [
            { title: 'Developer', salaryMin: 60, salaryMax: 120 },
            { title: 'Senior Developer', salaryMin: 90, salaryMax: 165 },
            { title: 'Lead Developer', salaryMin: 130, salaryMax: 220 },
        ].map((r, i) => ({
            ...r,
            minShifts: RANK_THRESHOLDS[i]!,
            cooldownSeconds: RANK_COOLDOWNS[i]!,
        })),
    },
    {
        id: 'doctor',
        minExperience: 250,
        ranks: [
            { title: 'Resident Doctor', salaryMin: 150, salaryMax: 260 },
            { title: 'Doctor', salaryMin: 210, salaryMax: 340 },
            { title: 'Chief Physician', salaryMin: 290, salaryMax: 440 },
        ].map((r, i) => ({
            ...r,
            minShifts: RANK_THRESHOLDS[i]!,
            cooldownSeconds: RANK_COOLDOWNS[i]!,
        })),
    },
    {
        id: 'ceo',
        minExperience: 500,
        ranks: [
            { title: 'CEO', salaryMin: 200, salaryMax: 500 },
            { title: 'Executive CEO', salaryMin: 300, salaryMax: 620 },
            { title: 'Founder & Chairman', salaryMin: 420, salaryMax: 800 },
        ].map((r, i) => ({
            ...r,
            minShifts: RANK_THRESHOLDS[i]!,
            cooldownSeconds: RANK_COOLDOWNS[i]!,
        })),
    },
];

export function getJob(id: string): JobInfo | undefined {
    return AVAILABLE_JOBS.find((j) => j.id === id);
}

/**
 * Resolves the highest rank a user has unlocked in a job, based on how many
 * shifts they've worked in that specific job.
 */
export function getRank(job: JobInfo, currentJobShifts: number): JobRank {
    let rank = job.ranks[0]!;
    for (const r of job.ranks) {
        if (currentJobShifts >= r.minShifts) rank = r;
    }
    return rank;
}

/** Uniform random salary roll within the rank's [salaryMin, salaryMax] range. */
export function rollSalary(rank: JobRank): number {
    return (
        Math.floor(Math.random() * (rank.salaryMax - rank.salaryMin + 1)) +
        rank.salaryMin
    );
}

/** Random experience gain per shift, 1 to 5. */
export function rollExpGain(): number {
    return Math.floor(Math.random() * 5) + 1;
}

function toUtcDate(date: Date): Date {
    return new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
    );
}

export interface StreakResult {
    streak: number;
    streakDate: Date;
}

/**
 * Daily streak: one credit per calendar day (UTC), regardless of how many
 * shifts are worked that day. Streaks reset to 1 if a day is skipped.
 */
export function computeStreak(
    now: Date,
    lastStreakDate: Date | null,
    currentStreak: number
): StreakResult {
    const today = toUtcDate(now);
    if (!lastStreakDate) {
        return { streak: 1, streakDate: today };
    }

    const savedDate = toUtcDate(lastStreakDate);
    const diffDays = Math.round(
        (today.getTime() - savedDate.getTime()) / 86400000
    );
    if (diffDays === 1) {
        return { streak: currentStreak + 1, streakDate: today };
    }
    if (diffDays > 1) {
        return { streak: 1, streakDate: today };
    }
    // diffDays === 0: already credited today, streak unchanged.
    return { streak: currentStreak, streakDate: lastStreakDate };
}

/** Salary bonus fraction for a given streak length, capped at STREAK_BONUS_CAP. */
export function streakBonusFor(streak: number): number {
    return Math.min(streak * STREAK_BONUS_PER_DAY, STREAK_BONUS_CAP);
}
