import { AVAILABLE_JOBS } from '../work.js';

/**
 * Every field here mirrors a value that lives (uncentralized) in the bot
 * app. Comments point at the file:line each default is drawn from, so
 * defaults can be re-checked against production without re-deriving them.
 */

// Mirrors DAILY_REWARD in apps/bot/src/modules/economy/constants.ts (500)
export const DAILY_REWARD_DEFAULT = 500;
// Mirrors MARRIAGE_DAILY_BONUS in apps/bot/src/modules/economy/commands/daily.ts (1.1)
export const MARRIAGE_DAILY_BONUS_DEFAULT = 1.1;
// Mirrors WEEKLY_REWARDS in apps/bot/src/jobs/WeeklyLeaderboardJob.ts (top 3)
export const WEEKLY_REWARDS_DEFAULT = [1000, 500, 250] as const;
// Mirrors QUESTS_CONFIG in apps/bot/src/services/QuestService.ts
export const QUEST_DAILY_WORK_TARGET_DEFAULT = 3;
export const QUEST_DAILY_WORK_REWARD_DEFAULT = 500;
export const QUEST_DAILY_CASINO_TARGET_DEFAULT = 5;
export const QUEST_DAILY_CASINO_REWARD_DEFAULT = 300;
export const QUEST_WEEKLY_WORK_TARGET_DEFAULT = 15;
export const QUEST_WEEKLY_WORK_REWARD_DEFAULT = 2000;
export const QUEST_WEEKLY_CASINO_TARGET_DEFAULT = 25;
export const QUEST_WEEKLY_CASINO_REWARD_DEFAULT = 1500;
// Mirrors EventService.ts: 5% roll per qualifying message, 1/3 split between
// coin/xp-buff/money-buff, 50-150 coin range on the coin branch.
export const EVENT_TRIGGER_CHANCE_DEFAULT = 0.05;
export const EVENT_COIN_MIN_DEFAULT = 50;
export const EVENT_COIN_MAX_DEFAULT = 150;
// Mirrors EconomyService.rob at apps/bot/src/services/EconomyService.ts:404-407
// (1-5% of victim's wallet, floor, minimum 1) and the 24h cooldown check above it.
export const ROB_STEAL_MIN_PCT_DEFAULT = 1;
export const ROB_STEAL_MAX_PCT_DEFAULT = 5;
export const ROB_COOLDOWN_HOURS_DEFAULT = 24;

export interface CasinoGameWeights {
    doubleOrNothing: number;
    coinflip: number;
    rps: number;
    slots: number;
}

export interface SimulationParams {
    // Population / activity
    /** Number of simulated players. */
    playerCount: number;
    /** Fraction (0..1) of players who are "active" on a given simulated day. */
    activeFraction: number;
    /** Avg qualifying messages per active player per day, drives the random-event roll count. */
    eventChannelMessagesPerActiveDay: number;

    // Daily claim
    /** Fraction (0..1) of active players who claim their daily reward that day. */
    dailyClaimRate: number;
    /** Fraction (0..1) of players who are married (gets the daily bonus). */
    marriageRate: number;

    // Work
    /** Avg number of work shifts an active player completes per active day. */
    avgWorkShiftsPerActiveDay: number;
    /** Relative weight per job in AVAILABLE_JOBS (same length/order), used to pick a player's job. */
    jobRankDistribution: number[];

    // Casino
    /** Fraction (0..1) of active players who gamble on a given active day. */
    casinoParticipationRate: number;
    /** Avg number of casino bets placed per participating player per active day. */
    avgCasinoBetsPerActivePlayer: number;
    /** Relative weights (need not sum to 1) for picking which casino game is played. */
    casinoGameWeights: CasinoGameWeights;
    /** Avg bet size as a fraction of the player's current balance (clamped to [1, MAX_BET]). */
    avgBetFraction: number;

    // Bank
    /** Fraction of balance an active player moves into their bank per active day. */
    depositRate: number;

    // Shop
    /** Probability (0..1) an active player buys an affordable shop item that day. */
    shopPurchaseRate: number;

    // Stocks
    /** Fraction (0..1) of active players who trade stocks on a given active day. */
    stockTradeParticipationRate: number;
    /** Avg trade size as a fraction of balance (for buys) or held value (for sells). */
    avgStockTradeFraction: number;

    // Rob
    /** Probability (0..1) an active player (off cooldown) attempts a rob that day. */
    robAttemptRate: number;

    // Control
    /** Number of days to simulate. */
    days: number;
    /** Starting balances are drawn uniformly from [startingBalanceMin, startingBalanceMax]. */
    startingBalanceMin: number;
    startingBalanceMax: number;
    /** Flat starting bank balance for every player. */
    startingBank: number;
}

export const DEFAULT_PARAMS: SimulationParams = {
    playerCount: 200,
    activeFraction: 0.4,
    eventChannelMessagesPerActiveDay: 20,

    dailyClaimRate: 0.8,
    marriageRate: 0.1,

    avgWorkShiftsPerActiveDay: 1.5,
    jobRankDistribution: AVAILABLE_JOBS.map(() => 1),

    casinoParticipationRate: 0.35,
    avgCasinoBetsPerActivePlayer: 3,
    casinoGameWeights: {
        doubleOrNothing: 1,
        coinflip: 1,
        rps: 1,
        slots: 1,
    },
    avgBetFraction: 0.15,

    depositRate: 0.2,

    shopPurchaseRate: 0.03,

    stockTradeParticipationRate: 0.1,
    avgStockTradeFraction: 0.1,

    robAttemptRate: 0.05,

    days: 90,
    startingBalanceMin: 0,
    startingBalanceMax: 2000,
    startingBank: 0,
};
