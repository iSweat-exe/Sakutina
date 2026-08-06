import { describe, expect, test } from 'bun:test';
import { CacheKeys } from './keys.js';

describe('CacheKeys.guildSettings', () => {
    test('builds a namespaced key from the guild id', () => {
        expect(CacheKeys.guildSettings('123456789')).toBe(
            'guild-settings:123456789'
        );
    });

    test('every built key starts with the shared prefix', () => {
        expect(CacheKeys.guildSettings('abc')).toStartWith(
            CacheKeys.guildSettingsPrefix
        );
    });
});
