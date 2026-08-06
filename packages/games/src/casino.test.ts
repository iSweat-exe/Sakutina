import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import {
    resolveCoinflip,
    resolveDoubleOrNothing,
    resolveRps,
    resolveSlots,
    RPS_CHOICES,
    type GameOutcome,
    type RpsChoice,
} from './casino.js';

afterEach(() => {
    (Math.random as unknown as { mockRestore?: () => void }).mockRestore?.();
});

describe('resolveDoubleOrNothing', () => {
    test('wins with a 2x multiplier when the roll is >= 0.5', () => {
        spyOn(Math, 'random').mockReturnValue(0.5);
        expect(resolveDoubleOrNothing()).toEqual({
            outcome: 'win',
            multiplier: 2,
        });
    });

    test('loses with a 0x multiplier when the roll is < 0.5', () => {
        spyOn(Math, 'random').mockReturnValue(0.4999);
        expect(resolveDoubleOrNothing()).toEqual({
            outcome: 'lose',
            multiplier: 0,
        });
    });
});

describe('resolveCoinflip', () => {
    test('wins when the coin lands on the chosen side', () => {
        spyOn(Math, 'random').mockReturnValue(0.5); // -> heads
        expect(resolveCoinflip('heads')).toEqual({
            result: 'heads',
            outcome: 'win',
            multiplier: 2,
        });
    });

    test('loses when the coin lands on the other side', () => {
        spyOn(Math, 'random').mockReturnValue(0.5); // -> heads
        expect(resolveCoinflip('tails')).toEqual({
            result: 'heads',
            outcome: 'lose',
            multiplier: 0,
        });
    });

    test('tails branch resolves correctly too', () => {
        spyOn(Math, 'random').mockReturnValue(0.1); // -> tails
        expect(resolveCoinflip('tails')).toEqual({
            result: 'tails',
            outcome: 'win',
            multiplier: 2,
        });
    });
});

describe('resolveRps', () => {
    // random -> botChoice index: [0, 1/3) rock, [1/3, 2/3) paper, [2/3, 1) scissors.
    const rollFor: Record<RpsChoice, number> = {
        rock: 0,
        paper: 0.34,
        scissors: 0.7,
    };

    test('exhaustively covers all 9 (choice, botChoice) combinations', () => {
        const expected: Record<
            string,
            { outcome: GameOutcome; multiplier: 0 | 1 | 2 }
        > = {
            'rock:rock': { outcome: 'tie', multiplier: 1 },
            'rock:paper': { outcome: 'lose', multiplier: 0 },
            'rock:scissors': { outcome: 'win', multiplier: 2 },
            'paper:rock': { outcome: 'win', multiplier: 2 },
            'paper:paper': { outcome: 'tie', multiplier: 1 },
            'paper:scissors': { outcome: 'lose', multiplier: 0 },
            'scissors:rock': { outcome: 'lose', multiplier: 0 },
            'scissors:paper': { outcome: 'win', multiplier: 2 },
            'scissors:scissors': { outcome: 'tie', multiplier: 1 },
        };

        for (const botChoice of RPS_CHOICES) {
            spyOn(Math, 'random').mockReturnValue(rollFor[botChoice]);
            for (const choice of RPS_CHOICES) {
                const result = resolveRps(choice);
                expect(result.botChoice).toBe(botChoice);
                const exp = expected[`${choice}:${botChoice}`]!;
                expect(result.outcome).toBe(exp.outcome);
                expect(result.multiplier).toBe(exp.multiplier);
            }
        }
    });
});

describe('resolveSlots', () => {
    // random -> reel index (SLOT_SYMBOLS has 6 entries): floor(random * 6).
    const reelRandomFor = {
        cherry: 0, // index 0 🍒
        lemon: 0.2, // index 1 🍋
        grape: 0.34, // index 2 🍇
        watermelon: 0.51, // index 3 🍉
        star: 0.67, // index 4 ⭐
        diamond: 0.84, // index 5 💎
    };

    test('triple diamonds pays the jackpot multiplier (10x)', () => {
        spyOn(Math, 'random').mockReturnValue(reelRandomFor.diamond);
        const result = resolveSlots();
        expect(result.reels).toEqual(['💎', '💎', '💎']);
        expect(result.outcome).toBe('win');
        expect(result.multiplier).toBe(10);
    });

    test('triple stars pays the secondary bonus multiplier (5x)', () => {
        spyOn(Math, 'random').mockReturnValue(reelRandomFor.star);
        const result = resolveSlots();
        expect(result.reels).toEqual(['⭐', '⭐', '⭐']);
        expect(result.multiplier).toBe(5);
    });

    test('any other triple pays the default multiplier (3x)', () => {
        spyOn(Math, 'random').mockReturnValue(reelRandomFor.cherry);
        const result = resolveSlots();
        expect(result.reels).toEqual(['🍒', '🍒', '🍒']);
        expect(result.multiplier).toBe(3);
    });

    test('a pair on reels 1-2 pays 1.5x', () => {
        const random = spyOn(Math, 'random');
        random.mockReturnValueOnce(reelRandomFor.cherry);
        random.mockReturnValueOnce(reelRandomFor.cherry);
        random.mockReturnValueOnce(reelRandomFor.lemon);
        const result = resolveSlots();
        expect(result.reels).toEqual(['🍒', '🍒', '🍋']);
        expect(result.outcome).toBe('win');
        expect(result.multiplier).toBe(1.5);
    });

    test('a pair on reels 2-3 pays 1.5x', () => {
        const random = spyOn(Math, 'random');
        random.mockReturnValueOnce(reelRandomFor.cherry);
        random.mockReturnValueOnce(reelRandomFor.lemon);
        random.mockReturnValueOnce(reelRandomFor.lemon);
        const result = resolveSlots();
        expect(result.reels).toEqual(['🍒', '🍋', '🍋']);
        expect(result.multiplier).toBe(1.5);
    });

    test('a pair on reels 1-3 pays 1.5x', () => {
        const random = spyOn(Math, 'random');
        random.mockReturnValueOnce(reelRandomFor.cherry);
        random.mockReturnValueOnce(reelRandomFor.lemon);
        random.mockReturnValueOnce(reelRandomFor.cherry);
        const result = resolveSlots();
        expect(result.reels).toEqual(['🍒', '🍋', '🍒']);
        expect(result.multiplier).toBe(1.5);
    });

    test('no matching reels loses with a 0 multiplier', () => {
        const random = spyOn(Math, 'random');
        random.mockReturnValueOnce(reelRandomFor.cherry);
        random.mockReturnValueOnce(reelRandomFor.lemon);
        random.mockReturnValueOnce(reelRandomFor.grape);
        const result = resolveSlots();
        expect(result.reels).toEqual(['🍒', '🍋', '🍇']);
        expect(result.outcome).toBe('lose');
        expect(result.multiplier).toBe(0);
    });
});
