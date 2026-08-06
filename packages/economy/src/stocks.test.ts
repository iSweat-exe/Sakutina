import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import { computeAvgBuyPrice, STOCK_LIST, tickStockPrice } from './stocks.js';

describe('STOCK_LIST', () => {
    test('every ticker is unique', () => {
        const tickers = STOCK_LIST.map((s) => s.ticker);
        expect(new Set(tickers).size).toBe(tickers.length);
    });

    test('every stock has a positive base price and volatility', () => {
        for (const stock of STOCK_LIST) {
            expect(stock.basePrice).toBeGreaterThan(0);
            expect(stock.volatility).toBeGreaterThan(0);
        }
    });
});

describe('tickStockPrice', () => {
    afterEach(() => {
        (
            Math.random as unknown as { mockRestore?: () => void }
        ).mockRestore?.();
    });

    test('with zero volatility, moves the price toward basePrice by the reversion factor', () => {
        // reversion = (basePrice - price) * 0.05, noise is zero since volatility is 0.
        expect(tickStockPrice(100, 200, 0)).toBe(105);
        expect(tickStockPrice(200, 100, 0)).toBe(195);
    });

    test('is a no-op when price already equals basePrice and volatility is zero', () => {
        expect(tickStockPrice(150, 150, 0)).toBe(150);
    });

    test('never returns a price below 1, even under a large downward swing', () => {
        spyOn(Math, 'random').mockReturnValue(0); // minimizes noise: -price * volatility
        expect(tickStockPrice(10, 10, 2)).toBe(1);
    });

    test('always returns an integer', () => {
        spyOn(Math, 'random').mockReturnValue(0.37);
        const result = tickStockPrice(87, 90, 0.05);
        expect(Number.isInteger(result)).toBe(true);
    });
});

describe('computeAvgBuyPrice', () => {
    test('computes the weighted average and rounds to the nearest integer', () => {
        expect(computeAvgBuyPrice(10, 5, 60, 10)).toBe(11);
        expect(computeAvgBuyPrice(10, 3, 25, 5)).toBe(11);
    });

    test('rounds .5 and above up', () => {
        expect(computeAvgBuyPrice(10, 3, 24, 5)).toBe(11); // 54 / 5 = 10.8
    });

    test('returns the cost-per-share when there is no existing position', () => {
        expect(computeAvgBuyPrice(0, 0, 100, 4)).toBe(25);
    });
});
