import { describe, expect, test } from 'bun:test';
import {
    computeBankInterest,
    MAX_BANK_INTEREST_PER_RUN,
    POOR_BANK_THRESHOLD,
    POOR_INTEREST_RATE,
    STANDARD_INTEREST_RATE,
} from './bank.js';

describe('computeBankInterest', () => {
    test('returns 0 for a non-positive balance', () => {
        expect(computeBankInterest(0)).toBe(0);
        expect(computeBankInterest(-100)).toBe(0);
    });

    test('applies the boosted poor rate at or below the threshold', () => {
        expect(computeBankInterest(1000)).toBe(
            Math.round(1000 * POOR_INTEREST_RATE)
        );
        expect(computeBankInterest(POOR_BANK_THRESHOLD)).toBe(
            Math.round(POOR_BANK_THRESHOLD * POOR_INTEREST_RATE)
        );
    });

    test('above the threshold, only the excess earns the standard rate', () => {
        const bank = POOR_BANK_THRESHOLD + 10_000;
        const expected =
            POOR_BANK_THRESHOLD * POOR_INTEREST_RATE +
            10_000 * STANDARD_INTEREST_RATE;
        expect(computeBankInterest(bank)).toBe(Math.round(expected));
    });

    test('has no cliff at the threshold a player could exploit by withdrawing down to it', () => {
        const at = computeBankInterest(POOR_BANK_THRESHOLD);
        const justAbove = computeBankInterest(POOR_BANK_THRESHOLD + 1);
        const justBelow = computeBankInterest(POOR_BANK_THRESHOLD - 1);
        expect(justAbove).toBeGreaterThanOrEqual(at);
        expect(at).toBeGreaterThanOrEqual(justBelow);
    });

    test('poor players always earn a higher effective rate than rich players', () => {
        const poorInterest = computeBankInterest(POOR_BANK_THRESHOLD);
        const richInterest = computeBankInterest(POOR_BANK_THRESHOLD * 10);
        const poorRate = poorInterest / POOR_BANK_THRESHOLD;
        const richRate = richInterest / (POOR_BANK_THRESHOLD * 10);
        expect(poorRate).toBeGreaterThan(richRate);
    });

    test('never exceeds the absolute cap, no matter how large the balance is', () => {
        expect(computeBankInterest(10_000_000)).toBe(MAX_BANK_INTEREST_PER_RUN);
        expect(computeBankInterest(1_000_000_000)).toBe(
            MAX_BANK_INTEREST_PER_RUN
        );
    });

    test('the cap does not affect normal balances below where it would bind', () => {
        // Pick a balance whose uncapped interest is well under the cap.
        const bank = POOR_BANK_THRESHOLD + 1000;
        const uncapped =
            POOR_BANK_THRESHOLD * POOR_INTEREST_RATE +
            1000 * STANDARD_INTEREST_RATE;
        expect(uncapped).toBeLessThan(MAX_BANK_INTEREST_PER_RUN);
        expect(computeBankInterest(bank)).toBe(Math.round(uncapped));
    });

    test('is monotonically non-decreasing as the balance grows', () => {
        let previous = 0;
        for (let bank = 0; bank <= 5_000_000; bank += 1000) {
            const interest = computeBankInterest(bank);
            expect(interest).toBeGreaterThanOrEqual(previous);
            previous = interest;
        }
    });
});
