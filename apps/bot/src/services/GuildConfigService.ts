import { eq, and } from 'drizzle-orm';
import { db, guildSettings, guildEventChannels } from '@sakutina/db';
import { Cache, CacheKeys } from '@sakutina/cache';

export interface GuildSettings {
    id: number;
    guildId: string;
    language: string;
    modLogChannel: string | null;
    maxWarns: number;
    modLogWarning: boolean;
    autoModEnabled: boolean;
    levelRoleId: string | null;
    levelRoleThreshold: number | null;
    leaderboardChannel: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export class GuildConfigService {
    /** TTL in seconds (5 minutes) */
    private static readonly CACHE_TTL_SECONDS = 5 * 60;

    /**
     * Cache lives in Redis, shared with apps/panel-server. Writes made from
     * the panel (ConfigService) invalidate the same key this reads, so the
     * two processes never disagree for longer than a single Redis round trip.
     */
    private static async getCached(
        guildId: string
    ): Promise<GuildSettings | undefined> {
        return Cache.getJSON<GuildSettings>(CacheKeys.guildSettings(guildId));
    }

    private static async setCached(guildId: string, data: GuildSettings) {
        await Cache.setJSON(
            CacheKeys.guildSettings(guildId),
            data,
            this.CACHE_TTL_SECONDS
        );
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
            .then((res) => res[0]);

        if (!existing) {
            await db.insert(guildEventChannels).values({ guildId, channelId });
        }
    }

    /**
     * Remove a channel from the random events pool
     */
    public static async removeEventChannel(guildId: string, channelId: string) {
        await db
            .delete(guildEventChannels)
            .where(
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
        return channels.map((c) => c.channelId);
    }

    /**
     * Invalidate a specific guild's cache entry.
     * Useful after manual DB edits or cross-shard notifications.
     */
    public static async invalidateCache(guildId: string) {
        await Cache.del(CacheKeys.guildSettings(guildId));
    }

    /**
     * Clear the entire cache. Useful on shard restart or bulk DB changes.
     */
    public static async clearCache() {
        await Cache.delByPrefix(CacheKeys.guildSettingsPrefix);
    }

    /**
     * Get guild settings from cache or database.
     * If they don't exist, create default settings.
     */
    public static async getGuildSettings(
        guildId: string
    ): Promise<GuildSettings> {
        const cached = await this.getCached(guildId);
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
                    autoModEnabled: false,
                    levelRoleId: null,
                    levelRoleThreshold: null,
                    leaderboardChannel: null,
                })
                .returning()
                .then((res) => res[0]);
            if (!settings) throw new Error('Failed to insert guild settings');
        }

        await this.setCached(guildId, settings);
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

        await this.setCached(guildId, updated);
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

        await this.setCached(guildId, updated);
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

        await this.setCached(guildId, updated);
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

        await this.setCached(guildId, updated);
        return updated;
    }

    /**
     * Toggle auto-moderation (spam/link detection). Disabled by default.
     */
    public static async setAutoModEnabled(
        guildId: string,
        enabled: boolean
    ): Promise<GuildSettings> {
        const updated = await db
            .insert(guildSettings)
            .values({ guildId, autoModEnabled: enabled })
            .onConflictDoUpdate({
                target: guildSettings.guildId,
                set: { autoModEnabled: enabled, updatedAt: new Date() },
            })
            .returning()
            .then((res) => res[0]);
        if (!updated) throw new Error('Failed to upsert auto-mod setting');

        await this.setCached(guildId, updated);
        return updated;
    }

    /**
     * Configure the role auto-granted once a member reaches a given level.
     * Pass roleId = null to disable.
     */
    public static async setLevelRole(
        guildId: string,
        roleId: string | null,
        threshold: number | null
    ): Promise<GuildSettings> {
        const updated = await db
            .insert(guildSettings)
            .values({
                guildId,
                levelRoleId: roleId,
                levelRoleThreshold: threshold,
            })
            .onConflictDoUpdate({
                target: guildSettings.guildId,
                set: {
                    levelRoleId: roleId,
                    levelRoleThreshold: threshold,
                    updatedAt: new Date(),
                },
            })
            .returning()
            .then((res) => res[0]);
        if (!updated) throw new Error('Failed to upsert level role');

        await this.setCached(guildId, updated);
        return updated;
    }

    /**
     * Configure the channel used for the weekly leaderboard reward
     * announcement. Pass null to disable the feature.
     */
    public static async setLeaderboardChannel(
        guildId: string,
        channelId: string | null
    ): Promise<GuildSettings> {
        const updated = await db
            .insert(guildSettings)
            .values({ guildId, leaderboardChannel: channelId })
            .onConflictDoUpdate({
                target: guildSettings.guildId,
                set: { leaderboardChannel: channelId, updatedAt: new Date() },
            })
            .returning()
            .then((res) => res[0]);
        if (!updated) throw new Error('Failed to upsert leaderboard channel');

        await this.setCached(guildId, updated);
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
