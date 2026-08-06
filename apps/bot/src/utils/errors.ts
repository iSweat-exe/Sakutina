/**
 * Base application error. All domain errors extend this.
 * Use `instanceof` checks instead of string matching on `error.message`.
 */
export class AppError extends Error {
    constructor(
        public readonly code: string,
        message: string,
        public readonly meta?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'AppError';
    }
}

export class InsufficientFundsError extends AppError {
    constructor() {
        super('INSUFFICIENT_FUNDS', 'Not enough coins');
    }
}

export class BetTooLargeError extends AppError {
    constructor(public readonly maxBet: number) {
        super('BET_TOO_LARGE', 'Bet exceeds the maximum allowed', { maxBet });
    }
}

export class EmptyWalletError extends AppError {
    constructor() {
        super('EMPTY_WALLET', 'User has no money to steal');
    }
}

export class CooldownError extends AppError {
    constructor(
        code: string,
        public readonly remaining: number,
        public readonly unit: 'seconds' | 'hours' = 'seconds'
    ) {
        super(code, 'On cooldown', { remaining, unit });
    }
}

export class CannotPaySelfError extends AppError {
    constructor() {
        super('PAY_SELF_ERROR', 'Cannot pay yourself');
    }
}

export class JobError extends AppError {
    constructor(
        code:
            | 'NOT_FOUND'
            | 'ALREADY_HAVE'
            | 'NO_JOB'
            | 'REMOVED'
            | 'INSUFFICIENT_EXP',
        meta?: Record<string, unknown>
    ) {
        super(`WORK_ERR_${code}`, `Job error: ${code}`, meta);
    }
}

export class ShopError extends AppError {
    constructor(
        code: 'NOT_FOUND' | 'ALREADY_OWNED' | 'NOT_OWNED',
        meta?: Record<string, unknown>
    ) {
        super(`SHOP_ERR_${code}`, `Shop error: ${code}`, meta);
    }
}

export class MarriageError extends AppError {
    constructor(
        code: 'SELF' | 'ALREADY_MARRIED' | 'TARGET_MARRIED' | 'NOT_MARRIED',
        meta?: Record<string, unknown>
    ) {
        super(`MARRIAGE_ERR_${code}`, `Marriage error: ${code}`, meta);
    }
}

export class GiveawayError extends AppError {
    constructor(
        code:
            | 'NOT_FOUND'
            | 'ALREADY_ENDED'
            | 'ALREADY_ENTERED'
            | 'MISSING_ROLE'
            | 'NOT_ENDED'
            | 'NO_ENTRIES',
        meta?: Record<string, unknown>
    ) {
        super(`GIVEAWAY_ERR_${code}`, `Giveaway error: ${code}`, meta);
    }
}

export class InvestError extends AppError {
    constructor(
        code: 'NOT_FOUND' | 'INSUFFICIENT_SHARES',
        meta?: Record<string, unknown>
    ) {
        super(`INVEST_ERR_${code}`, `Invest error: ${code}`, meta);
    }
}
