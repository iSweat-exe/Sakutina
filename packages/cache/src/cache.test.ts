import { beforeEach, describe, expect, mock, test } from 'bun:test';

// packages/cache/src/client.ts throws at import time when REDIS_URL is
// unset and eagerly opens a real ioredis connection otherwise, so the
// module is mocked out before Cache (which imports it) is loaded.
const store = new Map<string, string>();
let scanBatches: string[][] = [];
const setCalls: unknown[][] = [];
const delCalls: string[][] = [];

mock.module('./client.js', () => ({
    redis: {
        get: async (key: string) => store.get(key) ?? null,
        set: async (...args: unknown[]) => {
            setCalls.push(args);
            const [key, value] = args as [string, string];
            store.set(key, value);
            return 'OK';
        },
        del: async (...keys: string[]) => {
            delCalls.push(keys);
            let removed = 0;
            for (const key of keys) {
                if (store.delete(key)) removed++;
            }
            return removed;
        },
        scanStream: () => ({
            async *[Symbol.asyncIterator]() {
                for (const batch of scanBatches) yield batch;
            },
        }),
    },
}));

const { Cache } = await import('./cache.js');

beforeEach(() => {
    store.clear();
    scanBatches = [];
    setCalls.length = 0;
    delCalls.length = 0;
});

describe('Cache.getJSON', () => {
    test('returns undefined when the key is missing', async () => {
        expect(await Cache.getJSON('missing')).toBeUndefined();
    });

    test('parses and returns stored JSON', async () => {
        store.set('user:1', JSON.stringify({ balance: 42 }));
        expect(await Cache.getJSON<{ balance: number }>('user:1')).toEqual({
            balance: 42,
        });
    });

    test('returns undefined instead of throwing on malformed JSON', async () => {
        store.set('corrupt', '{not valid json');
        expect(await Cache.getJSON('corrupt')).toBeUndefined();
    });
});

describe('Cache.setJSON', () => {
    test('serializes the value and forwards the TTL with the EX flag', async () => {
        await Cache.setJSON('user:1', { balance: 42 }, 60);
        expect(setCalls).toEqual([
            ['user:1', JSON.stringify({ balance: 42 }), 'EX', 60],
        ]);
        expect(store.get('user:1')).toBe(JSON.stringify({ balance: 42 }));
    });
});

describe('Cache.del', () => {
    test('removes the key', async () => {
        store.set('user:1', 'x');
        await Cache.del('user:1');
        expect(store.has('user:1')).toBe(false);
    });
});

describe('Cache.delByPrefix', () => {
    test('deletes every key yielded by the scan stream', async () => {
        store.set('guild-settings:1', 'a');
        store.set('guild-settings:2', 'b');
        scanBatches = [['guild-settings:1'], ['guild-settings:2']];

        await Cache.delByPrefix('guild-settings:');

        expect(store.has('guild-settings:1')).toBe(false);
        expect(store.has('guild-settings:2')).toBe(false);
        expect(delCalls).toEqual([['guild-settings:1'], ['guild-settings:2']]);
    });

    test('skips calling del for empty scan batches', async () => {
        scanBatches = [[], []];
        await Cache.delByPrefix('nothing:');
        expect(delCalls).toEqual([]);
    });
});
