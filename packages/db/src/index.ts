export { db, checkDbConnection, closeDb } from './client.js';
export * from './schema.js';

import type {
    users,
    guildSettings,
    warns,
    reminders,
    guildEventChannels,
    userQuests,
    interactionStats,
    modActions,
    transactions,
    userInventory,
    marriages,
    channelActivity,
    activityHourly,
    voiceChannelStats,
} from './schema.js';

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type GuildSettingsRow = typeof guildSettings.$inferSelect;
export type Warn = typeof warns.$inferSelect;
export type Reminder = typeof reminders.$inferSelect;
export type GuildEventChannel = typeof guildEventChannels.$inferSelect;
export type UserQuest = typeof userQuests.$inferSelect;
export type InteractionStat = typeof interactionStats.$inferSelect;
export type ModAction = typeof modActions.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type UserInventoryItem = typeof userInventory.$inferSelect;
export type Marriage = typeof marriages.$inferSelect;
export type ChannelActivity = typeof channelActivity.$inferSelect;
export type ActivityHourly = typeof activityHourly.$inferSelect;
export type VoiceChannelStats = typeof voiceChannelStats.$inferSelect;

