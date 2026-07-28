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
