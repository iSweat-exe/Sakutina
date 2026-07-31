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
