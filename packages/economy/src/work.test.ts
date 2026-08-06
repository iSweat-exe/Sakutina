import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import {
    AVAILABLE_JOBS,
    computeStreak,
    getJob,
    getRank,
    rollExpGain,
    rollSalary,
    streakBonusFor,
    STREAK_BONUS_CAP,
    STREAK_BONUS_PER_DAY,
} from './work.js';

afterEach(() => {
    (Math.random as unknown as { mockRestore?: () => void }).mockRestore?.();
});

describe('AVAILABLE_JOBS', () => {
    test('every job id is unique', () => {
        const ids = AVAILABLE_JOBS.map((j) => j.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    test('every job has exactly 3 ranks with increasing salary bands', () => {
        for (const job of AVAILABLE_JOBS) {
            expect(job.ranks).toHaveLength(3);
            for (let i = 1; i < job.ranks.length; i++) {
                const prev = job.ranks[i - 1]!;
                const curr = job.ranks[i]!;
                expect(curr.minShifts).toBeGreaterThan(prev.minShifts);
                expect(curr.salaryMin).toBeGreaterThanOrEqual(prev.salaryMin);
                expect(curr.salaryMax).toBeGreaterThan(prev.salaryMax);
            }
        }
    });

    test('every rank has salaryMax >= salaryMin', () => {
        for (const job of AVAILABLE_JOBS) {
            for (const rank of job.ranks) {
                expect(rank.salaryMax).toBeGreaterThanOrEqual(rank.salaryMin);
            }
        }
    });
});

describe('getJob', () => {
    test('finds a known job by id', () => {
        expect(getJob('barista')?.id).toBe('barista');
    });

    test('returns undefined for an unknown id', () => {
        expect(getJob('astronaut')).toBeUndefined();
    });
});

describe('getRank', () => {
    const job = getJob('barista')!;

    test('returns the first rank below every threshold', () => {
        expect(getRank(job, 0).title).toBe('Barista');
        expect(getRank(job, 14).title).toBe('Barista');
    });

    test('promotes exactly at each minShifts threshold', () => {
        expect(getRank(job, 15).title).toBe('Senior Barista');
        expect(getRank(job, 39).title).toBe('Senior Barista');
        expect(getRank(job, 40).title).toBe('Shift Manager');
    });

    test('stays at the highest rank beyond its threshold', () => {
        expect(getRank(job, 10_000).title).toBe('Shift Manager');
    });
});

describe('rollSalary', () => {
    test('returns salaryMin when random rolls the lowest bucket', () => {
        spyOn(Math, 'random').mockReturnValue(0);
        const rank = getRank(getJob('barista')!, 0);
        expect(rollSalary(rank)).toBe(rank.salaryMin);
    });

    test('returns salaryMax when random rolls the highest bucket', () => {
        spyOn(Math, 'random').mockReturnValue(0.999999);
        const rank = getRank(getJob('barista')!, 0);
        expect(rollSalary(rank)).toBe(rank.salaryMax);
    });

    test('never exceeds the rank bounds across many rolls', () => {
        const rank = getRank(getJob('ceo')!, 1000);
        for (let i = 0; i < 200; i++) {
            const salary = rollSalary(rank);
            expect(salary).toBeGreaterThanOrEqual(rank.salaryMin);
            expect(salary).toBeLessThanOrEqual(rank.salaryMax);
        }
    });
});

describe('rollExpGain', () => {
    test('is always between 1 and 5 inclusive', () => {
        for (let i = 0; i < 200; i++) {
            const gain = rollExpGain();
            expect(gain).toBeGreaterThanOrEqual(1);
            expect(gain).toBeLessThanOrEqual(5);
        }
    });

    test('returns 1 for the lowest random roll and 5 for the highest', () => {
        spyOn(Math, 'random').mockReturnValue(0);
        expect(rollExpGain()).toBe(1);
        spyOn(Math, 'random').mockReturnValue(0.999999);
        expect(rollExpGain()).toBe(5);
    });
});

describe('computeStreak', () => {
    test('starts a new streak at 1 when there is no prior streak date', () => {
        const now = new Date(Date.UTC(2026, 0, 15, 10, 0, 0));
        const result = computeStreak(now, null, 0);
        expect(result.streak).toBe(1);
        expect(result.streakDate.getTime()).toBe(Date.UTC(2026, 0, 15));
    });

    test('increments the streak when exactly one calendar day (UTC) has passed', () => {
        const now = new Date(Date.UTC(2026, 0, 16, 3, 0, 0));
        const last = new Date(Date.UTC(2026, 0, 15, 23, 59, 0));
        const result = computeStreak(now, last, 4);
        expect(result.streak).toBe(5);
        expect(result.streakDate.getTime()).toBe(Date.UTC(2026, 0, 16));
    });

    test('resets the streak to 1 when more than one day has passed', () => {
        const now = new Date(Date.UTC(2026, 0, 20));
        const last = new Date(Date.UTC(2026, 0, 15));
        const result = computeStreak(now, last, 7);
        expect(result.streak).toBe(1);
        expect(result.streakDate.getTime()).toBe(Date.UTC(2026, 0, 20));
    });

    test('leaves the streak unchanged when already credited the same UTC day', () => {
        const now = new Date(Date.UTC(2026, 0, 15, 22, 0, 0));
        const last = new Date(Date.UTC(2026, 0, 15, 1, 0, 0));
        const result = computeStreak(now, last, 3);
        expect(result.streak).toBe(3);
        expect(result.streakDate).toBe(last);
    });
});

describe('streakBonusFor', () => {
    test('grows linearly with streak length below the cap', () => {
        expect(streakBonusFor(1)).toBeCloseTo(STREAK_BONUS_PER_DAY, 10);
        expect(streakBonusFor(5)).toBeCloseTo(5 * STREAK_BONUS_PER_DAY, 10);
    });

    test('is capped at STREAK_BONUS_CAP', () => {
        const streakAtCap = STREAK_BONUS_CAP / STREAK_BONUS_PER_DAY;
        expect(streakBonusFor(streakAtCap)).toBeCloseTo(STREAK_BONUS_CAP, 10);
        expect(streakBonusFor(streakAtCap + 10)).toBe(STREAK_BONUS_CAP);
        expect(streakBonusFor(1000)).toBe(STREAK_BONUS_CAP);
    });

    test('returns 0 for a zero streak', () => {
        expect(streakBonusFor(0)).toBe(0);
    });
});
