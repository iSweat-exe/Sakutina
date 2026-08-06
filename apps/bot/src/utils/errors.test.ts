import { describe, expect, test } from 'bun:test';
import {
    AppError,
    CannotPaySelfError,
    CooldownError,
    EmptyWalletError,
    GiveawayError,
    InsufficientFundsError,
    InvestError,
    JobError,
    MarriageError,
    ShopError,
} from './errors.js';

describe('AppError', () => {
    test('carries a code, message, and optional meta', () => {
        const error = new AppError('SOME_CODE', 'Something went wrong', {
            foo: 'bar',
        });
        expect(error).toBeInstanceOf(Error);
        expect(error.name).toBe('AppError');
        expect(error.code).toBe('SOME_CODE');
        expect(error.message).toBe('Something went wrong');
        expect(error.meta).toEqual({ foo: 'bar' });
    });
});

describe('domain error subclasses', () => {
    test('InsufficientFundsError has a fixed code and is an AppError', () => {
        const error = new InsufficientFundsError();
        expect(error).toBeInstanceOf(AppError);
        expect(error.code).toBe('INSUFFICIENT_FUNDS');
    });

    test('EmptyWalletError has a fixed code', () => {
        expect(new EmptyWalletError().code).toBe('EMPTY_WALLET');
    });

    test('CannotPaySelfError has a fixed code', () => {
        expect(new CannotPaySelfError().code).toBe('PAY_SELF_ERROR');
    });

    test('CooldownError composes its code and carries remaining/unit in meta', () => {
        const error = new CooldownError('WORK_COOLDOWN', 42, 'hours');
        expect(error.code).toBe('WORK_COOLDOWN');
        expect(error.remaining).toBe(42);
        expect(error.unit).toBe('hours');
        expect(error.meta).toEqual({ remaining: 42, unit: 'hours' });
    });

    test('CooldownError defaults its unit to seconds', () => {
        const error = new CooldownError('DAILY_COOLDOWN', 10);
        expect(error.unit).toBe('seconds');
    });

    test('JobError prefixes its code with WORK_ERR_', () => {
        const error = new JobError('INSUFFICIENT_EXP', { need: 100 });
        expect(error.code).toBe('WORK_ERR_INSUFFICIENT_EXP');
        expect(error.meta).toEqual({ need: 100 });
    });

    test('ShopError prefixes its code with SHOP_ERR_', () => {
        expect(new ShopError('ALREADY_OWNED').code).toBe(
            'SHOP_ERR_ALREADY_OWNED'
        );
    });

    test('MarriageError prefixes its code with MARRIAGE_ERR_', () => {
        expect(new MarriageError('TARGET_MARRIED').code).toBe(
            'MARRIAGE_ERR_TARGET_MARRIED'
        );
    });

    test('GiveawayError prefixes its code with GIVEAWAY_ERR_', () => {
        expect(new GiveawayError('MISSING_ROLE').code).toBe(
            'GIVEAWAY_ERR_MISSING_ROLE'
        );
    });

    test('InvestError prefixes its code with INVEST_ERR_', () => {
        expect(new InvestError('INSUFFICIENT_SHARES').code).toBe(
            'INVEST_ERR_INSUFFICIENT_SHARES'
        );
    });

    test('every subclass is distinguishable via instanceof', () => {
        const errors = [
            new InsufficientFundsError(),
            new EmptyWalletError(),
            new CannotPaySelfError(),
            new CooldownError('X', 1),
            new JobError('NO_JOB'),
            new ShopError('NOT_FOUND'),
            new MarriageError('SELF'),
            new GiveawayError('NOT_FOUND'),
            new InvestError('NOT_FOUND'),
        ];
        for (const error of errors) {
            expect(error).toBeInstanceOf(AppError);
            expect(error).toBeInstanceOf(Error);
        }
    });
});
