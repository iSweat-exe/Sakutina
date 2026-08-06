import { describe, expect, test } from 'bun:test';
import { formatDuration, formatLongDuration } from './time.js';

describe('formatDuration', () => {
    test('formats sub-minute durations as seconds only', () => {
        expect(formatDuration(0)).toBe('0s');
        expect(formatDuration(45)).toBe('45s');
    });

    test('formats minute+ durations as "Xm Ys"', () => {
        expect(formatDuration(60)).toBe('1m 0s');
        expect(formatDuration(125)).toBe('2m 5s');
    });

    test('rounds fractional seconds', () => {
        expect(formatDuration(59.6)).toBe('1m 0s');
        expect(formatDuration(59.4)).toBe('59s');
    });

    test('clamps negative input to zero', () => {
        expect(formatDuration(-10)).toBe('0s');
    });
});

describe('formatLongDuration', () => {
    test('delegates to formatDuration below one hour', () => {
        expect(formatLongDuration(45)).toBe('45s');
        expect(formatLongDuration(125)).toBe('2m 5s');
    });

    test('formats hour+ durations as "Xh Ym", dropping seconds', () => {
        expect(formatLongDuration(3600)).toBe('1h 0m');
        expect(formatLongDuration(3725)).toBe('1h 2m');
    });

    test('clamps negative input to zero', () => {
        expect(formatLongDuration(-10)).toBe('0s');
    });
});
