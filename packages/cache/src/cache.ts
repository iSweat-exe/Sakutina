import { redis } from './client.js';

export class Cache {
    public static async getJSON<T>(key: string): Promise<T | undefined> {
        const raw = await redis.get(key);
        if (!raw) return undefined;
        try {
            return JSON.parse(raw) as T;
        } catch {
            return undefined;
        }
    }

    public static async setJSON(
        key: string,
        value: unknown,
        ttlSeconds: number
    ): Promise<void> {
        await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    }

    public static async del(key: string): Promise<void> {
        await redis.del(key);
    }

    /**
     * Delete every key matching a prefix. Uses SCAN (non-blocking) rather
     * than KEYS, since this runs against a Redis instance shared with other
     * workloads.
     */
    public static async delByPrefix(prefix: string): Promise<void> {
        const stream = redis.scanStream({ match: `${prefix}*`, count: 100 });
        for await (const keys of stream) {
            if (keys.length > 0) await redis.del(...keys);
        }
    }
}
