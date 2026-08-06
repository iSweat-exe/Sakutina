import { describe, expect, test } from 'bun:test';
import { computeGini, mean, median } from './gini.js';

describe('computeGini', () => {
    test('is 0 for perfect equality', () => {
        expect(computeGini([100, 100, 100])).toBe(0);
        expect(computeGini([0, 0, 0, 0])).toBe(0);
    });

    test('is 0 for empty or single-value arrays', () => {
        expect(computeGini([])).toBe(0);
        expect(computeGini([50])).toBe(0);
    });

    test('approaches (n-1)/n for maximal concentration', () => {
        const gini = computeGini([0, 0, 0, 1000]);
        expect(gini).toBeCloseTo(0.75, 5);
    });

    test('is bounded between 0 and 1', () => {
        expect(computeGini([1, 2, 3, 4, 100])).toBeGreaterThan(0);
        expect(computeGini([1, 2, 3, 4, 100])).toBeLessThan(1);
    });

    test('increases as wealth concentrates', () => {
        const equal = computeGini([25, 25, 25, 25]);
        const skewed = computeGini([10, 10, 10, 70]);
        const maximal = computeGini([0, 0, 0, 100]);
        expect(skewed).toBeGreaterThan(equal);
        expect(maximal).toBeGreaterThan(skewed);
    });
});

describe('mean', () => {
    test('computes the arithmetic mean', () => {
        expect(mean([1, 2, 3, 4])).toBe(2.5);
    });

    test('is 0 for an empty array', () => {
        expect(mean([])).toBe(0);
    });
});

describe('median', () => {
    test('returns the middle value for an odd-length array', () => {
        expect(median([5, 1, 3])).toBe(3);
    });

    test('averages the two middle values for an even-length array', () => {
        expect(median([1, 2, 3, 4])).toBe(2.5);
    });

    test('is 0 for an empty array', () => {
        expect(median([])).toBe(0);
    });
});
