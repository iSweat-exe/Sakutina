import {
    AVAILABLE_JOBS,
    computeStreak,
    getRank,
    rollSalary,
    streakBonusFor,
} from '../work.js';
import { computeBankInterest } from '../bank.js';
import { SHOP_ITEMS } from '../shop.js';
import { computeAvgBuyPrice, STOCK_LIST, tickStockPrice } from '../stocks.js';
import {
    MAX_BET,
    resolveCoinflip,
    resolveDoubleOrNothing,
    resolveRps,
    resolveSlots,
    RPS_CHOICES,
    type CoinSide,
} from '@sakutina/games';
import {
    DAILY_REWARD_DEFAULT,
    EVENT_COIN_MAX_DEFAULT,
    EVENT_COIN_MIN_DEFAULT,
    EVENT_TRIGGER_CHANCE_DEFAULT,
    MARRIAGE_DAILY_BONUS_DEFAULT,
    QUEST_DAILY_CASINO_REWARD_DEFAULT,
    QUEST_DAILY_CASINO_TARGET_DEFAULT,
    QUEST_DAILY_WORK_REWARD_DEFAULT,
    QUEST_DAILY_WORK_TARGET_DEFAULT,
    QUEST_WEEKLY_CASINO_REWARD_DEFAULT,
    QUEST_WEEKLY_CASINO_TARGET_DEFAULT,
    QUEST_WEEKLY_WORK_REWARD_DEFAULT,
    QUEST_WEEKLY_WORK_TARGET_DEFAULT,
    ROB_COOLDOWN_HOURS_DEFAULT,
    ROB_STEAL_MAX_PCT_DEFAULT,
    ROB_STEAL_MIN_PCT_DEFAULT,
    WEEKLY_REWARDS_DEFAULT,
    type CasinoGameWeights,
    type SimulationParams,
} from './params.js';
import { createInitialPlayers, type SimPlayer } from './player.js';
import { computeGini, mean, median } from './gini.js';

export interface DailyFlowBreakdown {
    daily: number;
    work: number;
    casino: number;
    bankInterest: number;
    weeklyLeaderboard: number;
    quests: number;
    randomEvents: number;
    shop: number;
    stockNet: number;
    robNet: number;
}

export interface DailySnapshot {
    day: number;
    totalSupply: number;
    /** Positive-only slice of each category's net effect that day. */
    inflow: DailyFlowBreakdown;
    /** Absolute value of the negative-only slice of each category's net effect that day. */
    outflow: DailyFlowBreakdown;
    gini: number;
    medianWealth: number;
    meanWealth: number;
}

function emptyFlow(): DailyFlowBreakdown {
    return {
        daily: 0,
        work: 0,
        casino: 0,
        bankInterest: 0,
        weeklyLeaderboard: 0,
        quests: 0,
        randomEvents: 0,
        shop: 0,
        stockNet: 0,
        robNet: 0,
    };
}

function splitFlow(net: DailyFlowBreakdown): {
    inflow: DailyFlowBreakdown;
    outflow: DailyFlowBreakdown;
} {
    const inflow = emptyFlow();
    const outflow = emptyFlow();
    for (const key of Object.keys(net) as (keyof DailyFlowBreakdown)[]) {
        const value = net[key];
        if (value > 0) inflow[key] = value;
        else if (value < 0) outflow[key] = -value;
    }
    return { inflow, outflow };
}

/** Rounds a fractional average (e.g. 1.5) to a whole count without bias. */
function sampleCount(avg: number): number {
    const whole = Math.floor(avg);
    const frac = avg - whole;
    return whole + (Math.random() < frac ? 1 : 0);
}

function pickCasinoGame(weights: CasinoGameWeights): keyof CasinoGameWeights {
    const entries = Object.entries(weights) as [
        keyof CasinoGameWeights,
        number,
    ][];
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    if (total <= 0) return entries[0]![0];
    let roll = Math.random() * total;
    for (const [key, w] of entries) {
        roll -= w;
        if (roll <= 0) return key;
    }
    return entries[entries.length - 1]![0];
}

/**
 * Applies one simulated day to `players` in place (and advances the shared
 * `stockPrices` price path), using the real production formulas from
 * @sakutina/economy and @sakutina/games wherever they exist. Execution
 * order: stock prices tick first (so trades that day see the new price),
 * then per-active-player daily claim / work / casino / bank deposit / shop /
 * stock trade, then a robbery pass (separate so a robbery can't be dodged by
 * ordering), then bank interest (mirrors the real cron running once/day),
 * then random events, weekly leaderboard (every 7th day) and quests.
 */
export function simulateDay(
    players: SimPlayer[],
    day: number,
    params: SimulationParams,
    stockPrices: Record<string, number>
): DailySnapshot {
    const simDate = new Date(Date.UTC(2000, 0, 1 + day));
    const net = emptyFlow();

    for (const stock of STOCK_LIST) {
        const current = stockPrices[stock.ticker] ?? stock.basePrice;
        stockPrices[stock.ticker] = tickStockPrice(
            current,
            stock.basePrice,
            stock.volatility
        );
    }

    const isNewWeek = day % 7 === 0;
    for (const player of players) {
        player.shiftsToday = 0;
        player.betsToday = 0;
        player.dailyWorkQuestClaimed = false;
        player.dailyCasinoQuestClaimed = false;
        if (isNewWeek) {
            player.shiftsThisWeek = 0;
            player.betsThisWeek = 0;
            player.weeklyWorkQuestClaimed = false;
            player.weeklyCasinoQuestClaimed = false;
        }
    }

    const activePlayers = players.filter(
        () => Math.random() < params.activeFraction
    );

    for (const player of activePlayers) {
        if (Math.random() < params.dailyClaimRate) {
            const amount = player.married
                ? Math.floor(
                      DAILY_REWARD_DEFAULT * MARRIAGE_DAILY_BONUS_DEFAULT
                  )
                : DAILY_REWARD_DEFAULT;
            player.balance += amount;
            net.daily += amount;
        }

        const shiftCount = sampleCount(params.avgWorkShiftsPerActiveDay);
        for (let i = 0; i < shiftCount; i++) {
            const job = AVAILABLE_JOBS[player.jobIndex] ?? AVAILABLE_JOBS[0]!;
            const rank = getRank(job, player.jobShifts);
            const streakResult = computeStreak(
                simDate,
                player.streakDate,
                player.streak
            );
            player.streak = streakResult.streak;
            player.streakDate = streakResult.streakDate;
            const salary = Math.floor(
                rollSalary(rank) * (1 + streakBonusFor(player.streak))
            );
            player.balance += salary;
            player.jobShifts += 1;
            player.shiftsToday += 1;
            player.shiftsThisWeek += 1;
            net.work += salary;
        }

        if (Math.random() < params.casinoParticipationRate) {
            const betCount = sampleCount(params.avgCasinoBetsPerActivePlayer);
            for (let i = 0; i < betCount; i++) {
                if (player.balance < 1) break;
                const bet = Math.min(
                    MAX_BET,
                    Math.max(
                        1,
                        Math.round(player.balance * params.avgBetFraction)
                    )
                );
                if (bet > player.balance) break;

                const game = pickCasinoGame(params.casinoGameWeights);
                let payout = 0;
                switch (game) {
                    case 'doubleOrNothing': {
                        const { multiplier } = resolveDoubleOrNothing();
                        payout = bet * multiplier;
                        break;
                    }
                    case 'coinflip': {
                        const choice: CoinSide =
                            Math.random() < 0.5 ? 'heads' : 'tails';
                        const { multiplier } = resolveCoinflip(choice);
                        payout = bet * multiplier;
                        break;
                    }
                    case 'rps': {
                        const choice =
                            RPS_CHOICES[
                                Math.floor(Math.random() * RPS_CHOICES.length)
                            ]!;
                        const { multiplier } = resolveRps(choice);
                        payout = bet * multiplier;
                        break;
                    }
                    case 'slots': {
                        const { multiplier } = resolveSlots();
                        payout = Math.floor(bet * multiplier);
                        break;
                    }
                }

                const netChange = payout - bet;
                player.balance += netChange;
                net.casino += netChange;
                player.betsToday += 1;
                player.betsThisWeek += 1;
            }
        }

        if (player.balance > 0) {
            const deposit = Math.floor(player.balance * params.depositRate);
            if (deposit > 0) {
                player.balance -= deposit;
                player.bank += deposit;
            }
        }

        if (Math.random() < params.shopPurchaseRate) {
            const affordable = SHOP_ITEMS.filter(
                (item) => item.price <= player.balance
            );
            if (affordable.length > 0) {
                const item =
                    affordable[Math.floor(Math.random() * affordable.length)]!;
                player.balance -= item.price;
                net.shop -= item.price;
            }
        }

        if (Math.random() < params.stockTradeParticipationRate) {
            const stock =
                STOCK_LIST[Math.floor(Math.random() * STOCK_LIST.length)]!;
            const price = stockPrices[stock.ticker] ?? stock.basePrice;
            const holding = player.stockHoldings[stock.ticker];
            const isBuy = !holding || holding.qty === 0 || Math.random() < 0.5;

            if (isBuy) {
                const spend = Math.floor(
                    player.balance * params.avgStockTradeFraction
                );
                const qty = Math.floor(spend / price);
                if (qty > 0) {
                    const cost = qty * price;
                    player.balance -= cost;
                    net.stockNet -= cost;
                    const newQty = (holding?.qty ?? 0) + qty;
                    const avgBuyPrice = holding
                        ? computeAvgBuyPrice(
                              holding.avgBuyPrice,
                              holding.qty,
                              cost,
                              newQty
                          )
                        : price;
                    player.stockHoldings[stock.ticker] = {
                        qty: newQty,
                        avgBuyPrice,
                    };
                }
            } else if (holding && holding.qty > 0) {
                const sellQty = Math.min(
                    holding.qty,
                    Math.max(
                        1,
                        Math.floor(holding.qty * params.avgStockTradeFraction)
                    )
                );
                const proceeds = sellQty * price;
                player.balance += proceeds;
                net.stockNet += proceeds;
                holding.qty -= sellQty;
            }
        }
    }

    for (const robber of activePlayers) {
        if (
            robber.robCooldownUntil &&
            robber.robCooldownUntil.getTime() > simDate.getTime()
        )
            continue;
        if (Math.random() >= params.robAttemptRate) continue;

        const candidates = players.filter((p) => p.id !== robber.id);
        if (candidates.length === 0) continue;
        const victim =
            candidates[Math.floor(Math.random() * candidates.length)]!;

        robber.robCooldownUntil = new Date(
            simDate.getTime() + ROB_COOLDOWN_HOURS_DEFAULT * 60 * 60 * 1000
        );
        if (victim.balance <= 0) continue;

        const pct =
            Math.floor(
                Math.random() *
                    (ROB_STEAL_MAX_PCT_DEFAULT - ROB_STEAL_MIN_PCT_DEFAULT + 1)
            ) + ROB_STEAL_MIN_PCT_DEFAULT;
        let stolen = Math.floor(victim.balance * (pct / 100));
        if (stolen === 0) stolen = 1;
        stolen = Math.min(stolen, victim.balance);

        victim.balance -= stolen;
        robber.balance += stolen;
        // Zero-sum transfer: doesn't change net.robNet, tracked for clarity only.
    }

    for (const player of players) {
        if (player.bank > 0) {
            const interest = computeBankInterest(player.bank);
            player.bank += interest;
            net.bankInterest += interest;
        }
    }

    const qualifyingMessages =
        activePlayers.length * params.eventChannelMessagesPerActiveDay;
    const eventCount = Math.floor(
        qualifyingMessages * EVENT_TRIGGER_CHANCE_DEFAULT
    );
    for (let i = 0; i < eventCount; i++) {
        if (activePlayers.length === 0) break;
        const claimant =
            activePlayers[Math.floor(Math.random() * activePlayers.length)]!;
        const roll = Math.floor(Math.random() * 3);
        if (roll === 0) {
            const amount =
                Math.floor(
                    Math.random() *
                        (EVENT_COIN_MAX_DEFAULT - EVENT_COIN_MIN_DEFAULT + 1)
                ) + EVENT_COIN_MIN_DEFAULT;
            claimant.balance += amount;
            net.randomEvents += amount;
        }
        // roll === 1 (XP buff) and roll === 2 (2x work-money buff) have no
        // direct currency effect modeled here — documented simplification.
    }

    if (day % 7 === 6) {
        const ranked = [...players].sort(
            (a, b) => b.balance + b.bank - (a.balance + a.bank)
        );
        for (
            let i = 0;
            i < WEEKLY_REWARDS_DEFAULT.length && i < ranked.length;
            i++
        ) {
            const reward = WEEKLY_REWARDS_DEFAULT[i]!;
            ranked[i]!.balance += reward;
            net.weeklyLeaderboard += reward;
        }
    }

    for (const player of players) {
        if (
            !player.dailyWorkQuestClaimed &&
            player.shiftsToday >= QUEST_DAILY_WORK_TARGET_DEFAULT
        ) {
            player.balance += QUEST_DAILY_WORK_REWARD_DEFAULT;
            net.quests += QUEST_DAILY_WORK_REWARD_DEFAULT;
            player.dailyWorkQuestClaimed = true;
        }
        if (
            !player.dailyCasinoQuestClaimed &&
            player.betsToday >= QUEST_DAILY_CASINO_TARGET_DEFAULT
        ) {
            player.balance += QUEST_DAILY_CASINO_REWARD_DEFAULT;
            net.quests += QUEST_DAILY_CASINO_REWARD_DEFAULT;
            player.dailyCasinoQuestClaimed = true;
        }
        if (
            !player.weeklyWorkQuestClaimed &&
            player.shiftsThisWeek >= QUEST_WEEKLY_WORK_TARGET_DEFAULT
        ) {
            player.balance += QUEST_WEEKLY_WORK_REWARD_DEFAULT;
            net.quests += QUEST_WEEKLY_WORK_REWARD_DEFAULT;
            player.weeklyWorkQuestClaimed = true;
        }
        if (
            !player.weeklyCasinoQuestClaimed &&
            player.betsThisWeek >= QUEST_WEEKLY_CASINO_TARGET_DEFAULT
        ) {
            player.balance += QUEST_WEEKLY_CASINO_REWARD_DEFAULT;
            net.quests += QUEST_WEEKLY_CASINO_REWARD_DEFAULT;
            player.weeklyCasinoQuestClaimed = true;
        }
    }

    const { inflow, outflow } = splitFlow(net);
    const wealth = players.map((p) => p.balance + p.bank);

    return {
        day,
        totalSupply: wealth.reduce((sum, w) => sum + w, 0),
        inflow,
        outflow,
        gini: computeGini(wealth),
        medianWealth: median(wealth),
        meanWealth: mean(wealth),
    };
}

/** Runs `params.days` simulated days from scratch, returning the full daily series. */
export function runSimulation(params: SimulationParams): DailySnapshot[] {
    const players = createInitialPlayers(params);
    const stockPrices: Record<string, number> = {};
    for (const stock of STOCK_LIST) stockPrices[stock.ticker] = stock.basePrice;

    const series: DailySnapshot[] = [];
    for (let day = 0; day < params.days; day++) {
        series.push(simulateDay(players, day, params, stockPrices));
    }
    return series;
}
