import {
    pgTable,
    text,
    serial,
    integer,
    timestamp,
    boolean,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
    id: serial('id').primaryKey(),
    discordId: text('discord_id').notNull().unique(),
    experience: integer('experience').default(0).notNull(),
    balance: integer('balance').default(0).notNull(),
    bank: integer('bank').default(0).notNull(),
    dailyLastClaim: timestamp('daily_last_claim'),
    currentJob: text('current_job'),
    workShiftsDone: integer('work_shifts_done').default(0).notNull(),
    workLastShift: timestamp('work_last_shift'),
    casinoGamesPlayed: integer('casino_games_played').default(0).notNull(),
    casinoWins: integer('casino_wins').default(0).notNull(),
    casinoLosses: integer('casino_losses').default(0).notNull(),
    modKicks: integer('mod_kicks').default(0).notNull(),
    modBans: integer('mod_bans').default(0).notNull(),
    modMutes: integer('mod_mutes').default(0).notNull(),
    bonusXpUntil: timestamp('bonus_xp_until'),
    bonusMoneyUntil: timestamp('bonus_money_until'),
    bonusJobUntil: timestamp('bonus_job_until'),
    robLastAttempt: timestamp('rob_last_attempt'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const guildSettings = pgTable('guild_settings', {
    id: serial('id').primaryKey(),
    guildId: text('guild_id').notNull().unique(),
    language: text('language').default('en').notNull(),
    modLogChannel: text('mod_log_channel'),
    maxWarns: integer('max_warns').default(3).notNull(),
    modLogWarning: boolean('mod_log_warning').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const warns = pgTable('warns', {
    id: serial('id').primaryKey(),
    guildId: text('guild_id').notNull(),
    userId: text('user_id').notNull(),
    moderatorId: text('moderator_id').notNull(),
    reason: text('reason').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const reminders = pgTable('reminders', {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull(),
    channelId: text('channel_id').notNull(),
    message: text('message').notNull(),
    remindAt: timestamp('remind_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const guildEventChannels = pgTable('guild_event_channels', {
    id: serial('id').primaryKey(),
    guildId: text('guild_id').notNull(),
    channelId: text('channel_id').notNull(),
});

export const userQuests = pgTable('user_quests', {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull(),
    questId: text('quest_id').notNull(),
    progress: integer('progress').default(0).notNull(),
    target: integer('target').notNull(),
    type: text('type').notNull(), // 'daily' | 'weekly'
    completed: boolean('completed').default(false).notNull(),
    expiresAt: timestamp('expires_at').notNull(),
});
