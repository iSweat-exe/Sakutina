export type GameOutcome = 'win' | 'lose' | 'tie';

export const SLOT_SYMBOLS = ['🍒', '🍋', '🍇', '🍉', '⭐', '💎'] as const;
export type SlotSymbol = (typeof SLOT_SYMBOLS)[number];

// Keyed directly off SLOT_SYMBOLS values (not re-typed string literals) so a
// mismatched byte encoding can never silently break the jackpot tiers.
const SLOT_TRIPLE_BONUS: Partial<Record<SlotSymbol, number>> = {
    '💎': 10,
    '⭐': 5,
};
const SLOT_TRIPLE_DEFAULT_MULTIPLIER = 3;
const SLOT_PAIR_MULTIPLIER = 1.5;

export const RPS_CHOICES = ['rock', 'paper', 'scissors'] as const;
export type RpsChoice = (typeof RPS_CHOICES)[number];

export type CoinSide = 'heads' | 'tails';

export interface DoubleOrNothingResult {
    outcome: 'win' | 'lose';
    multiplier: 0 | 2;
}

/** 50/50 double-or-nothing, zero house edge. */
export function resolveDoubleOrNothing(): DoubleOrNothingResult {
    const isWin = Math.random() >= 0.5;
    return { outcome: isWin ? 'win' : 'lose', multiplier: isWin ? 2 : 0 };
}

export interface CoinflipResult {
    result: CoinSide;
    outcome: 'win' | 'lose';
    multiplier: 0 | 2;
}

export function resolveCoinflip(choice: CoinSide): CoinflipResult {
    const flip: CoinSide = Math.random() >= 0.5 ? 'heads' : 'tails';
    const isWin = choice === flip;
    return {
        result: flip,
        outcome: isWin ? 'win' : 'lose',
        multiplier: isWin ? 2 : 0,
    };
}

export interface RpsResult {
    botChoice: RpsChoice;
    outcome: GameOutcome;
    multiplier: 0 | 1 | 2;
}

export function resolveRps(choice: RpsChoice): RpsResult {
    const botChoice =
        RPS_CHOICES[Math.floor(Math.random() * RPS_CHOICES.length)]!;

    let outcome: GameOutcome = 'lose';
    if (choice === botChoice) {
        outcome = 'tie';
    } else if (
        (choice === 'rock' && botChoice === 'scissors') ||
        (choice === 'paper' && botChoice === 'rock') ||
        (choice === 'scissors' && botChoice === 'paper')
    ) {
        outcome = 'win';
    }

    const multiplier = outcome === 'win' ? 2 : outcome === 'tie' ? 1 : 0;
    return { botChoice, outcome, multiplier };
}

export interface SlotsResult {
    reels: [SlotSymbol, SlotSymbol, SlotSymbol];
    outcome: 'win' | 'lose';
    multiplier: number;
}

export function resolveSlots(): SlotsResult {
    const draw = () =>
        SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)]!;
    const reels: [SlotSymbol, SlotSymbol, SlotSymbol] = [
        draw(),
        draw(),
        draw(),
    ];
    const [reel1, reel2, reel3] = reels;

    let multiplier = 0;
    if (reel1 === reel2 && reel2 === reel3) {
        multiplier = SLOT_TRIPLE_BONUS[reel1] ?? SLOT_TRIPLE_DEFAULT_MULTIPLIER;
    } else if (reel1 === reel2 || reel2 === reel3 || reel1 === reel3) {
        multiplier = SLOT_PAIR_MULTIPLIER;
    }

    return { reels, outcome: multiplier > 0 ? 'win' : 'lose', multiplier };
}
