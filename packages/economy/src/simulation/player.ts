import type { SimulationParams } from './params.js';

export interface StockHolding {
    qty: number;
    avgBuyPrice: number;
}

export interface SimPlayer {
    id: number;
    balance: number;
    bank: number;
    /** Index into AVAILABLE_JOBS. */
    jobIndex: number;
    /** Total shifts worked in the current job, drives getRank(). */
    jobShifts: number;
    streak: number;
    streakDate: Date | null;
    married: boolean;
    robCooldownUntil: Date | null;
    /** Keyed by ticker. */
    stockHoldings: Record<string, StockHolding>;
    /** Shifts/bets worked or placed today and this simulated week, for quest tracking. */
    shiftsToday: number;
    betsToday: number;
    shiftsThisWeek: number;
    betsThisWeek: number;
    dailyWorkQuestClaimed: boolean;
    dailyCasinoQuestClaimed: boolean;
    weeklyWorkQuestClaimed: boolean;
    weeklyCasinoQuestClaimed: boolean;
}

function pickWeightedIndex(weights: number[]): number {
    const total = weights.reduce((sum, w) => sum + w, 0);
    if (total <= 0) return Math.floor(Math.random() * weights.length);
    let roll = Math.random() * total;
    for (let i = 0; i < weights.length; i++) {
        roll -= weights[i]!;
        if (roll <= 0) return i;
    }
    return weights.length - 1;
}

export function createInitialPlayers(params: SimulationParams): SimPlayer[] {
    const players: SimPlayer[] = [];
    for (let id = 0; id < params.playerCount; id++) {
        const balance = Math.floor(
            params.startingBalanceMin +
                Math.random() *
                    (params.startingBalanceMax - params.startingBalanceMin)
        );
        players.push({
            id,
            balance,
            bank: params.startingBank,
            jobIndex: pickWeightedIndex(params.jobRankDistribution),
            jobShifts: 0,
            streak: 0,
            streakDate: null,
            married: Math.random() < params.marriageRate,
            robCooldownUntil: null,
            stockHoldings: {},
            shiftsToday: 0,
            betsToday: 0,
            shiftsThisWeek: 0,
            betsThisWeek: 0,
            dailyWorkQuestClaimed: false,
            dailyCasinoQuestClaimed: false,
            weeklyWorkQuestClaimed: false,
            weeklyCasinoQuestClaimed: false,
        });
    }
    return players;
}
