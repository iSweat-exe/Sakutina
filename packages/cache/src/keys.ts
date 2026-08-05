/**
 * Central key namespace. Both apps/bot and apps/panel-server import these
 * builders so a cache write from one process is a cache hit (and correctly
 * invalidated) in the other — they're two clients of the same Redis instance.
 */
export const CacheKeys = {
    guildSettings: (guildId: string) => `guild-settings:${guildId}`,
    guildSettingsPrefix: 'guild-settings:',
};
