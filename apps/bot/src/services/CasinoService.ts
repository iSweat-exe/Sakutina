import { eq, sql, and } from 'drizzle-orm';
import { db, users } from '@sakutina/db';
import {
    MAX_BET,
    resolveCoinflip,
    resolveDoubleOrNothing,
    resolveRps,
    resolveSlots,
} from '@sakutina/games';
import { EconomyService } from './EconomyService.js';
import { BetTooLargeError, InsufficientFundsError } from '../utils/errors.js';

type GameOutcome = 'win' | 'lose' | 'tie';

interface GameResult<T> {
    outcome: GameOutcome;
    /** Total amount credited back to the user (0 if they lost everything). */
    payout: number;
    extra: T;
}

export class CasinoService {
    /**
     * Runs a bet atomically: checks funds, applies the outcome computed by
     * `resolve`, updates casino stats and logs the transaction, all within a
     * single DB transaction so a mid-flight failure can never make a bet
     * vanish without a payout (or vice versa).
     */
    private static async playGame<T>(
        discordId: string,
        guildId: string,
        bet: number,
        label: string,
        resolve: () => GameResult<T>
    ): Promise<GameResult<T>> {
        if (bet <= 0) throw new Error('Bet must be positive');
        if (bet > MAX_BET) throw new BetTooLargeError(MAX_BET);
        await EconomyService.ensureUser(discordId, guildId);

        return db.transaction(async (tx) => {
            const user = await tx
                .select()
                .from(users)
                .where(
                    and(
                        eq(users.discordId, discordId),
                        eq(users.guildId, guildId)
                    )
                )
                .then((res) => res[0]);
            if (!user || user.balance < bet) throw new InsufficientFundsError();

            const result = resolve();
            const netChange = result.payout - bet;

            await tx
                .update(users)
                .set({
                    balance: sql`${users.balance} + ${netChange}`,
                    casinoGamesPlayed: sql`${users.casinoGamesPlayed} + 1`,
                    casinoWins:
                        result.outcome === 'win'
                            ? sql`${users.casinoWins} + 1`
                            : sql`${users.casinoWins}`,
                    casinoLosses:
                        result.outcome === 'lose'
                            ? sql`${users.casinoLosses} + 1`
                            : sql`${users.casinoLosses}`,
                    updatedAt: new Date(),
                })
                .where(
                    and(
                        eq(users.discordId, discordId),
                        eq(users.guildId, guildId)
                    )
                );

            await EconomyService.logTransaction(
                discordId,
                guildId,
                'casino',
                netChange,
                label,
                tx
            );

            return result;
        });
    }

    /**
     * Double or Nothing game.
     * 50% chance to win double the bet, 50% chance to lose it.
     */
    public static async doubleOrNothing(
        discordId: string,
        guildId: string,
        bet: number
    ) {
        const result = await this.playGame(
            discordId,
            guildId,
            bet,
            'Double or nothing',
            () => {
                const { outcome, multiplier } = resolveDoubleOrNothing();
                return { outcome, payout: bet * multiplier, extra: null };
            }
        );
        return { win: result.outcome === 'win', amount: result.payout };
    }

    /**
     * Coinflip game.
     * Bet on "heads" or "tails".
     */
    public static async coinflip(
        discordId: string,
        guildId: string,
        bet: number,
        choice: 'heads' | 'tails'
    ) {
        const result = await this.playGame(
            discordId,
            guildId,
            bet,
            'Coinflip',
            () => {
                const {
                    result: flip,
                    outcome,
                    multiplier,
                } = resolveCoinflip(choice);
                return {
                    outcome,
                    payout: bet * multiplier,
                    extra: { result: flip },
                };
            }
        );
        return {
            win: result.outcome === 'win',
            amount: result.payout,
            result: result.extra.result,
        };
    }

    /**
     * Rock Paper Scissors game.
     * Bet an amount against the bot.
     */
    public static async rps(
        discordId: string,
        guildId: string,
        bet: number,
        choice: 'rock' | 'paper' | 'scissors'
    ) {
        const result = await this.playGame(
            discordId,
            guildId,
            bet,
            'RPS',
            () => {
                const { botChoice, outcome, multiplier } = resolveRps(choice);
                return {
                    outcome,
                    payout: bet * multiplier,
                    extra: { botChoice },
                };
            }
        );
        return {
            state: result.outcome,
            botChoice: result.extra.botChoice,
            returnAmount: result.payout,
        };
    }

    /**
     * Slots game.
     * Simple 3-reel slot machine.
     */
    public static async slots(discordId: string, guildId: string, bet: number) {
        const result = await this.playGame(
            discordId,
            guildId,
            bet,
            'Slots',
            () => {
                const { reels, outcome, multiplier } = resolveSlots();
                const winAmount = Math.floor(bet * multiplier);
                return {
                    outcome: winAmount > 0 ? outcome : 'lose',
                    payout: winAmount,
                    extra: { reels },
                };
            }
        );
        return {
            reels: result.extra.reels,
            win: result.outcome === 'win',
            winAmount: result.payout,
        };
    }
}
