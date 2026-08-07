import { db, guildSettings, type GuildSettingsRow } from '@sakutina/db';
import { eq } from 'drizzle-orm';
import { Cache, CacheKeys } from '@sakutina/cache';

export interface ConfigUpdate {
    language?: 'en' | 'fr';
    modLogChannel?: string | null;
    maxWarns?: number;
    modLogWarning?: boolean;
    autoModEnabled?: boolean;
    levelRoleId?: string | null;
    levelRoleThreshold?: number | null;
    leaderboardChannel?: string | null;
}

/**
 * Thin CRUD wrapper around guildSettings for the panel API. Shares its Redis
 * cache (same key, same instance) with apps/bot's GuildConfigService, so a
 * write from either process is immediately visible to the other instead of
 * waiting out a 5-minute TTL.
 */
export class ConfigService {
    /** TTL in seconds (5 minutes), matches apps/bot's GuildConfigService */
    private static readonly CACHE_TTL_SECONDS = 5 * 60;

    public static async getGuildSettings(
        guildId: string
    ): Promise<GuildSettingsRow> {
        const cached = await Cache.getJSON<GuildSettingsRow>(
            CacheKeys.guildSettings(guildId)
        );
        if (cached) return cached;

        let settings = await db
            .select()
            .from(guildSettings)
            .where(eq(guildSettings.guildId, guildId))
            .then((res) => res[0]);

        if (!settings) {
            // `onConflictDoNothing` + re-select fallback: two concurrent
            // first-touch requests for the same guild can't both miss the
            // SELECT above and both hit the unique `guildId` insert — one
            // wins, the other falls back to re-selecting the row it created.
            settings = await db
                .insert(guildSettings)
                .values({ guildId })
                .onConflictDoNothing()
                .returning()
                .then((res) => res[0]);

            if (!settings) {
                settings = await db
                    .select()
                    .from(guildSettings)
                    .where(eq(guildSettings.guildId, guildId))
                    .then((res) => res[0]);
            }
            if (!settings) throw new Error('Failed to insert guild settings');
        }

        await Cache.setJSON(
            CacheKeys.guildSettings(guildId),
            settings,
            this.CACHE_TTL_SECONDS
        );
        return settings;
    }

    public static async updateGuildSettings(
        guildId: string,
        update: ConfigUpdate
    ): Promise<GuildSettingsRow> {
        const updated = await db
            .insert(guildSettings)
            .values({ guildId, ...update })
            .onConflictDoUpdate({
                target: guildSettings.guildId,
                set: { ...update, updatedAt: new Date() },
            })
            .returning()
            .then((res) => res[0]);
        if (!updated) throw new Error('Failed to upsert guild settings');

        await Cache.setJSON(
            CacheKeys.guildSettings(guildId),
            updated,
            this.CACHE_TTL_SECONDS
        );
        return updated;
    }
}
