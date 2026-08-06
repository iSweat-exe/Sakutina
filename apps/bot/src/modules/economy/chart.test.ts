import { describe, expect, test } from 'bun:test';
import type { StockPriceHistoryRow } from '@sakutina/db';
import { buildStockChartUrl } from './chart.js';

function row(price: number, id = 1): StockPriceHistoryRow {
    return { id, ticker: 'SAKU', price, recordedAt: new Date() };
}

function parseConfig(url: string) {
    const parsed = new URL(url);
    return JSON.parse(parsed.searchParams.get('c')!);
}

describe('buildStockChartUrl', () => {
    test('returns a quickchart.io URL', () => {
        const url = buildStockChartUrl('SAKU', [row(250)], 260);
        expect(url.startsWith('https://quickchart.io/chart?')).toBe(true);
    });

    test('appends the current price as the final data point', () => {
        const config = parseConfig(
            buildStockChartUrl('SAKU', [row(250), row(255)], 260)
        );
        const dataset = config.data.datasets[0];
        expect(dataset.data).toEqual([250, 255, 260]);
        expect(dataset.label).toBe('SAKU');
    });

    test('trims history to the last 15 points before appending the current price', () => {
        const history = Array.from({ length: 30 }, (_, i) => row(100 + i));
        const config = parseConfig(buildStockChartUrl('SAKU', history, 500));
        const dataset = config.data.datasets[0];
        // last 15 of the 30 history rows (prices 115..129) plus the current price.
        expect(dataset.data).toHaveLength(16);
        expect(dataset.data[0]).toBe(115);
        expect(dataset.data[dataset.data.length - 1]).toBe(500);
    });

    test('uses the up color when the current price is at or above the open price', () => {
        const config = parseConfig(buildStockChartUrl('SAKU', [row(100)], 120));
        expect(config.data.datasets[0].borderColor).toBe('#2ECC71');
    });

    test('uses the down color when the current price is below the open price', () => {
        const config = parseConfig(buildStockChartUrl('SAKU', [row(100)], 80));
        expect(config.data.datasets[0].borderColor).toBe('#ED4245');
    });

    test('treats an equal open/current price as "up"', () => {
        const config = parseConfig(buildStockChartUrl('SAKU', [row(100)], 100));
        expect(config.data.datasets[0].borderColor).toBe('#2ECC71');
    });

    test('falls back to the current price as the open when history is empty', () => {
        const config = parseConfig(buildStockChartUrl('SAKU', [], 42));
        expect(config.data.datasets[0].data).toEqual([42]);
        expect(config.data.datasets[0].borderColor).toBe('#2ECC71'); // openPrice === currentPrice
    });

    test('pads the y-axis range and never lets the min drop below zero', () => {
        const config = parseConfig(buildStockChartUrl('SAKU', [row(2)], 3));
        expect(config.options.scales.y.min).toBeGreaterThanOrEqual(0);
        expect(config.options.scales.y.max).toBeGreaterThan(
            config.options.scales.y.min
        );
    });

    test('marks only the last point as visible (pointRadius)', () => {
        const config = parseConfig(
            buildStockChartUrl('SAKU', [row(100), row(110)], 120)
        );
        const radii = config.data.datasets[0].pointRadius as number[];
        expect(radii.slice(0, -1).every((r) => r === 0)).toBe(true);
        expect(radii[radii.length - 1]).toBe(5);
    });
});
