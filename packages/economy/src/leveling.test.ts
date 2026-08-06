import { describe, expect, test } from 'bun:test';
import { calculateLevel } from './leveling.js';

describe('calculateLevel', () => {
    test('returns 0 for zero xp', () => {
        expect(calculateLevel(0)).toBe(0);
    });

    test('matches the documented formula: floor(sqrt(xp / 10))', () => {
        expect(calculateLevel(10)).toBe(1);
        expect(calculateLevel(40)).toBe(2);
        expect(calculateLevel(90)).toBe(3);
        expect(calculateLevel(160)).toBe(4);
    });

    test('floors down when xp is just below a level threshold', () => {
        expect(calculateLevel(39)).toBe(1);
        expect(calculateLevel(89)).toBe(2);
    });

    test('is monotonically non-decreasing as xp grows', () => {
        let previous = calculateLevel(0);
        for (let xp = 0; xp <= 1000; xp += 17) {
            const level = calculateLevel(xp);
            expect(level).toBeGreaterThanOrEqual(previous);
            previous = level;
        }
    });
});
