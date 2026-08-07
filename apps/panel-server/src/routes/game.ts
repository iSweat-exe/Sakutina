import { Hono, type Context } from 'hono';
import { db, users, transactions } from '@sakutina/db';
import { and, eq, gte, sql } from 'drizzle-orm';
import {
    MAX_BET,
    resolveCoinflip,
    resolveDoubleOrNothing,
    resolveRps,
    resolveSlots,
    type CoinSide,
    type RpsChoice,
} from '@sakutina/games';
import { requireAuth, requireGuildMember } from '../auth/middleware.js';
import { bindGuildId, getGuildId } from '../utils/params.js';
import { isPositiveIntegerInRange, parseJsonBody } from '../utils/validate.js';
import { ensureUser } from '../lib/economy.js';
import { incrementQuestProgress } from '../lib/quests.js';
import type { AppEnv } from '../types.js';

export const gameRoutes = new Hono<AppEnv>();

gameRoutes.use('*', bindGuildId, requireAuth, requireGuildMember);

gameRoutes.get('/me', async (c) => {
    const guildId = getGuildId(c);
    const session = c.get('session');
    const user = await ensureUser(session.discordUserId, guildId);
    return c.json({ balance: user.balance });
});

type CasinoGame = 'coinflip' | 'rps' | 'slots' | 'donothing';

interface CasinoOutcome {
    outcome: 'win' | 'lose' | 'tie';
    payout: number;
    extra: Record<string, unknown>;
}

function resolveCasinoGame(
    game: CasinoGame,
    bet: number,
    choice: unknown
): CasinoOutcome | null {
    switch (game) {
        case 'donothing': {
            const { outcome, multiplier } = resolveDoubleOrNothing();
            return { outcome, payout: bet * multiplier, extra: {} };
        }
        case 'coinflip': {
            if (choice !== 'heads' && choice !== 'tails') return null;
            const {
                result: flip,
                outcome,
                multiplier,
            } = resolveCoinflip(choice as CoinSide);
            return {
                outcome,
                payout: bet * multiplier,
                extra: { result: flip },
            };
        }
        case 'rps': {
            if (
                choice !== 'rock' &&
                choice !== 'paper' &&
                choice !== 'scissors'
            )
                return null;
            const { botChoice, outcome, multiplier } = resolveRps(
                choice as RpsChoice
            );
            return { outcome, payout: bet * multiplier, extra: { botChoice } };
        }
        case 'slots': {
            const { reels, outcome, multiplier } = resolveSlots();
            const winAmount = Math.floor(bet * multiplier);
            return {
                outcome: winAmount > 0 ? outcome : 'lose',
                payout: winAmount,
                extra: { reels },
            };
        }
        default:
            return null;
    }
}

async function readBetBody(c: Context<AppEnv>) {
    const body = await parseJsonBody(c.req);
    if (!body || !isPositiveIntegerInRange(body.bet, MAX_BET)) return null;
    return { bet: body.bet, choice: body.choice };
}

gameRoutes.post('/casino/:game', async (c) => {
    const guildId = getGuildId(c);
    const session = c.get('session');
    const discordId = session.discordUserId;
    const game = c.req.param('game') as CasinoGame;

    if (!['coinflip', 'rps', 'slots', 'donothing'].includes(game)) {
        return c.json({ error: 'Unknown game' }, 404);
    }

    const body = await readBetBody(c);
    if (!body)
        return c.json(
            {
                error: `bet must be a positive integer no greater than ${MAX_BET}`,
            },
            400
        );

    await ensureUser(discordId, guildId);

    const result = await db.transaction(async (tx) => {
        const outcome = resolveCasinoGame(game, body.bet, body.choice);
        if (!outcome) return null;

        const netChange = outcome.payout - body.bet;

        // Guard the bet in the UPDATE's WHERE (not a prior SELECT) so
        // concurrent bets can't both read a stale balance and both go
        // through — only one can match `balance >= bet` at a time.
        const updated = await tx
            .update(users)
            .set({
                balance: sql`${users.balance} + ${netChange}`,
                casinoGamesPlayed: sql`${users.casinoGamesPlayed} + 1`,
                casinoWins:
                    outcome.outcome === 'win'
                        ? sql`${users.casinoWins} + 1`
                        : sql`${users.casinoWins}`,
                casinoLosses:
                    outcome.outcome === 'lose'
                        ? sql`${users.casinoLosses} + 1`
                        : sql`${users.casinoLosses}`,
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(users.discordId, discordId),
                    eq(users.guildId, guildId),
                    gte(users.balance, body.bet)
                )
            )
            .returning()
            .then((res) => res[0]);
        if (!updated) return 'insufficient_funds' as const;

        await tx.insert(transactions).values({
            userId: discordId,
            guildId,
            type: 'casino',
            amount: netChange,
            details: `Panel ${game}`,
        });

        return { outcome, balance: updated.balance };
    });

    if (result === 'insufficient_funds') {
        return c.json({ error: 'Insufficient funds' }, 400);
    }
    if (!result) {
        return c.json({ error: 'Insufficient funds or invalid choice' }, 400);
    }

    await incrementQuestProgress(discordId, guildId, 'casino').catch(() => {});

    return c.json({
        outcome: result.outcome.outcome,
        payout: result.outcome.payout,
        extra: result.outcome.extra,
        balance: result.balance,
    });
});
