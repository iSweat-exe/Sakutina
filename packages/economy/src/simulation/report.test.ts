import { describe, expect, test } from 'bun:test';
import { DEFAULT_PARAMS, type SimulationParams } from './params.js';
import { buildHtmlReport, buildReportBody } from './report.js';
import { runSimulation } from './tick.js';

describe('buildReportBody', () => {
    test('returns a placeholder when there are no simulated days', () => {
        const body = buildReportBody([], DEFAULT_PARAMS);
        expect(body).toContain('No days simulated');
    });

    test('renders one chart card per metric group for a real run', () => {
        const params: SimulationParams = {
            ...DEFAULT_PARAMS,
            playerCount: 20,
            days: 5,
        };
        const series = runSimulation(params);

        const body = buildReportBody(series, params);

        expect(body).toContain('Total money supply');
        expect(body).toContain('Wealth distribution');
        expect(body).toContain('Inequality (Gini');
        expect(body).toContain('Inflow by source');
        expect(body).toContain('Outflow by sink');
        expect(body).toContain('Net flow by category');
        expect(body.match(/<svg/g)?.length).toBe(6);
    });

    test('omits flow categories that never occur in the run', () => {
        const params: SimulationParams = {
            ...DEFAULT_PARAMS,
            playerCount: 10,
            days: 3,
            activeFraction: 1,
            dailyClaimRate: 1,
            marriageRate: 0,
            avgWorkShiftsPerActiveDay: 0,
            casinoParticipationRate: 0,
            stockTradeParticipationRate: 0,
            robAttemptRate: 0,
            depositRate: 0,
            eventChannelMessagesPerActiveDay: 0,
            shopPurchaseRate: 0,
            startingBalanceMin: 0,
            startingBalanceMax: 0,
            startingBank: 0,
        };
        const series = runSimulation(params);

        const body = buildReportBody(series, params);

        expect(body).not.toContain('>Casino</text>');
        expect(body).not.toContain('>Shop</text>');
    });
});

describe('buildHtmlReport', () => {
    test('wraps the report body in a full standalone document', () => {
        const params: SimulationParams = {
            ...DEFAULT_PARAMS,
            playerCount: 10,
            days: 2,
        };
        const series = runSimulation(params);

        const html = buildHtmlReport(series, params);

        expect(html.startsWith('<!doctype html>')).toBe(true);
        expect(html).toContain('<title>Economy simulation report</title>');
        expect(html).toContain('<div class="sim-report">');
    });
});
