import { describe, expect, test } from 'bun:test';
import { STOCK_LIST } from '../stocks.js';
import { DEFAULT_PARAMS, type SimulationParams } from './params.js';
import { createInitialPlayers } from './player.js';
import { runSimulation, simulateDay } from './tick.js';

function initStockPrices(): Record<string, number> {
    const prices: Record<string, number> = {};
    for (const stock of STOCK_LIST) prices[stock.ticker] = stock.basePrice;
    return prices;
}

function totalWealth(players: { balance: number; bank: number }[]): number {
    return players.reduce((sum, p) => sum + p.balance + p.bank, 0);
}

describe('simulateDay', () => {
    test('a day with zero activity leaves total supply unchanged', () => {
        const params: SimulationParams = {
            ...DEFAULT_PARAMS,
            playerCount: 10,
            activeFraction: 0,
            startingBank: 0,
        };
        const players = createInitialPlayers(params);
        const before = totalWealth(players);

        const snapshot = simulateDay(players, 0, params, initStockPrices());

        expect(snapshot.totalSupply).toBe(before);
        expect(totalWealth(players)).toBe(before);
    });

    test('a sink-only scenario (shop only) strictly reduces total supply over time', () => {
        const params: SimulationParams = {
            ...DEFAULT_PARAMS,
            playerCount: 20,
            activeFraction: 1,
            dailyClaimRate: 0,
            avgWorkShiftsPerActiveDay: 0,
            casinoParticipationRate: 0,
            stockTradeParticipationRate: 0,
            robAttemptRate: 0,
            depositRate: 0,
            eventChannelMessagesPerActiveDay: 0,
            shopPurchaseRate: 1,
            startingBalanceMin: 50_000,
            startingBalanceMax: 60_000,
            startingBank: 0,
        };
        const players = createInitialPlayers(params);
        const stockPrices = initStockPrices();

        let previous = totalWealth(players);
        const start = previous;
        for (let day = 0; day < 5; day++) {
            const snapshot = simulateDay(players, day, params, stockPrices);
            expect(snapshot.totalSupply).toBeLessThanOrEqual(previous);
            previous = snapshot.totalSupply;
        }
        expect(previous).toBeLessThan(start);
    });

    test('a source-only scenario (daily claim only) increases supply by exactly playerCount * reward per day', () => {
        const params: SimulationParams = {
            ...DEFAULT_PARAMS,
            playerCount: 15,
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
            days: 3,
        };
        const players = createInitialPlayers(params);
        const stockPrices = initStockPrices();

        for (let day = 0; day < 3; day++) {
            const before = totalWealth(players);
            const snapshot = simulateDay(players, day, params, stockPrices);
            expect(snapshot.totalSupply - before).toBe(
                params.playerCount * 500
            );
        }
    });

    test('never lets total supply or any player balance/bank go negative over a 30-day default run', () => {
        const params: SimulationParams = {
            ...DEFAULT_PARAMS,
            playerCount: 60,
            days: 30,
        };
        const players = createInitialPlayers(params);
        const stockPrices = initStockPrices();

        for (let day = 0; day < params.days; day++) {
            const snapshot = simulateDay(players, day, params, stockPrices);
            expect(snapshot.totalSupply).toBeGreaterThanOrEqual(0);
            expect(snapshot.gini).toBeGreaterThanOrEqual(0);
            expect(snapshot.gini).toBeLessThanOrEqual(1);
            for (const player of players) {
                expect(player.balance).toBeGreaterThanOrEqual(0);
                expect(player.bank).toBeGreaterThanOrEqual(0);
            }
        }
    });

    test('a slots-only casino scenario trends net-negative in aggregate (confirms the -25% EV survives)', () => {
        const params: SimulationParams = {
            ...DEFAULT_PARAMS,
            playerCount: 300,
            days: 20,
            activeFraction: 1,
            dailyClaimRate: 0,
            avgWorkShiftsPerActiveDay: 0,
            casinoParticipationRate: 1,
            avgCasinoBetsPerActivePlayer: 10,
            casinoGameWeights: {
                doubleOrNothing: 0,
                coinflip: 0,
                rps: 0,
                slots: 1,
            },
            avgBetFraction: 0.1,
            stockTradeParticipationRate: 0,
            robAttemptRate: 0,
            depositRate: 0,
            eventChannelMessagesPerActiveDay: 0,
            shopPurchaseRate: 0,
            startingBalanceMin: 1000,
            startingBalanceMax: 5000,
            startingBank: 0,
        };

        const series = runSimulation(params);
        const netCasino = series.reduce(
            (sum, s) => sum + (s.inflow.casino - s.outflow.casino),
            0
        );
        expect(netCasino).toBeLessThan(0);
    });
});
