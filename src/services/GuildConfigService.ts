import { eq, and } from 'drizzle-orm';
import { db } from '../repositories/db.js';
import { guildSettings, guildEventChannels } from '../repositories/schema.js';

export interface GuildSettings {
    id: number;
    guildId: string;
    language: string;
    modLogChannel: string | null;
    maxWarns: number;
    modLogWarning: boolean;
    createdAt: Date;
    updatedAt: Date;
}

interface CacheEntry {
    data: GuildSettings;
    expiresAt: number;
}

export class GuildConfigService {
    /** TTL in milliseconds (5 minutes) */
    private static readonly CACHE_TTL_MS = 5 * 60 * 1000;
    /** Maximum number of guilds to keep in cache */
    private static readonly CACHE_MAX_SIZE = 1000;

    private static cache = new Map<string, CacheEntry>();

    /**
     * Evict expired entries and enforce max size (LRU-like: oldest entries first).
     */
    private static pruneCache() {
        const now = Date.now();

        // Remove expired entries
        for (const [key, entry] of this.cache) {
            if (entry.expiresAt <= now) {
                this.cache.delete(key);
            }
        }

        // If still over max size, remove oldest entries (Map preserves insertion order)
        if (this.cache.size > this.CACHE_MAX_SIZE) {
            const excess = this.cache.size - this.CACHE_MAX_SIZE;
            const keys = this.cache.keys();
            for (let i = 0; i < excess; i++) {
                const next = keys.next();
                if (!next.done) this.cache.delete(next.value);
            }
        }
    }

    private static getCached(guildId: string): GuildSettings | undefined {
        const entry = this.cache.get(guildId);
        if (!entry) return undefined;
        if (entry.expiresAt <= Date.now()) {
            this.cache.delete(guildId);
            return undefined;
        }
        return entry.data;
    }

    private static setCached(guildId: string, data: GuildSettings) {
        // Prune before inserting to keep size bounded
        if (this.cache.size >= this.CACHE_MAX_SIZE) {
            this.pruneCache();
        }
        this.cache.set(guildId, {
            data,
            expiresAt: Date.now() + this.CACHE_TTL_MS,
        });
    }

    /**
     * Add a channel to the random events pool
     */
    public static async addEventChannel(guildId: string, channelId: string) {
        // Prevent duplicate entries
        const existing = await db
            .select()
            .from(guildEventChannels)
            .where(
                and(
                    eq(guildEventChannels.guildId, guildId),
                    eq(guildEventChannels.channelId, channelId)
                )
            )
            .then(res => res[0]);

        if (!existing) {
            await db.insert(guildEventChannels).values({ guildId, channelId });
        }
    }

    /**
     * Remove a channel from the random events pool
     */
    public static async removeEventChannel(guildId: string, channelId: string) {
        await db.delete(guildEventChannels).where(
            and(
                eq(guildEventChannels.guildId, guildId),
                eq(guildEventChannels.channelId, channelId)
            )
        );
    }

    /**
     * Get all event channels for a guild
     */
    public static async getEventChannels(guildId: string): Promise<string[]> {
        const channels = await db
            .select({ channelId: guildEventChannels.channelId })
            .from(guildEventChannels)
            .where(eq(guildEventChannels.guildId, guildId));
        return channels.map(c => c.channelId);
    }

    /**
     * Invalidate a specific guild's cache entry.
     * Useful after manual DB edits or cross-shard notifications.
     */
    public static invalidateCache(guildId: string) {
        this.cache.delete(guildId);
    }

    /**
     * Clear the entire cache. Useful on shard restart or bulk DB changes.
     */
    public static clearCache() {
        this.cache.clear();
    }

    /**
     * Get guild settings from cache or database.
     * If they don't exist, create default settings.
     */
    public static async getGuildSettings(
        guildId: string
    ): Promise<GuildSettings> {
        const cached = this.getCached(guildId);
        if (cached) return cached;

        let settings = await db
            .select()
            .from(guildSettings)
            .where(eq(guildSettings.guildId, guildId))
            .then((res) => res[0]);

        if (!settings) {
            settings = await db
                .insert(guildSettings)
                .values({
                    guildId,
                    language: 'en',
                    modLogChannel: null,
                    maxWarns: 3,
                    modLogWarning: true,
                })
                .returning()
                .then((res) => res[0]);
            if (!settings) throw new Error('Failed to insert guild settings');
        }

        this.setCached(guildId, settings);
        return settings;
    }

    /**
     * Update the language for a guild.
     */
    public static async setLanguage(
        guildId: string,
        language: 'en' | 'fr'
    ): Promise<GuildSettings> {
        const updated = await db
            .insert(guildSettings)
            .values({ guildId, language })
            .onConflictDoUpdate({
                target: guildSettings.guildId,
                set: { language, updatedAt: new Date() },
            })
            .returning()
            .then((res) => res[0]);
        if (!updated) throw new Error('Failed to upsert guild language');

        this.setCached(guildId, updated);
        return updated;
    }

    public static async setModLogChannel(
        guildId: string,
        channelId: string | null
    ): Promise<GuildSettings> {
        const updated = await db
            .insert(guildSettings)
            .values({ guildId, modLogChannel: channelId })
            .onConflictDoUpdate({
                target: guildSettings.guildId,
                set: { modLogChannel: channelId, updatedAt: new Date() },
            })
            .returning()
            .then((res) => res[0]);
        if (!updated) throw new Error('Failed to upsert mod log channel');

        this.setCached(guildId, updated);
        return updated;
    }

    public static async setMaxWarns(
        guildId: string,
        maxWarns: number
    ): Promise<GuildSettings> {
        const updated = await db
            .insert(guildSettings)
            .values({ guildId, maxWarns })
            .onConflictDoUpdate({
                target: guildSettings.guildId,
                set: { maxWarns, updatedAt: new Date() },
            })
            .returning()
            .then((res) => res[0]);
        if (!updated) throw new Error('Failed to upsert max warns');

        this.setCached(guildId, updated);
        return updated;
    }

    public static async setModLogWarning(
        guildId: string,
        enabled: boolean
    ): Promise<GuildSettings> {
        const updated = await db
            .insert(guildSettings)
            .values({ guildId, modLogWarning: enabled })
            .onConflictDoUpdate({
                target: guildSettings.guildId,
                set: { modLogWarning: enabled, updatedAt: new Date() },
            })
            .returning()
            .then((res) => res[0]);
        if (!updated) throw new Error('Failed to upsert mod log warning');

        this.setCached(guildId, updated);
        return updated;
    }

    /**
     * Helper to quickly get the guild's configured language.
     * Defaults to "en" if no guildId is provided (e.g. for DMs).
     */
    public static async getGuildLanguage(
        guildId?: string | null
    ): Promise<string> {
        if (!guildId) return 'en';
        const settings = await this.getGuildSettings(guildId);
        return settings.language;
    }
}
