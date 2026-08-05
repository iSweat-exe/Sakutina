import {
    pgTable,
    text,
    serial,
    integer,
    timestamp,
    boolean,
    uniqueIndex,
    index,
} from 'drizzle-orm/pg-core';

export const users = pgTable(
    'users',
    {
        id: serial('id').primaryKey(),
        discordId: text('discord_id').notNull(),
        guildId: text('guild_id').notNull(),
        experience: integer('experience').default(0).notNull(),
        balance: integer('balance').default(0).notNull(),
        bank: integer('bank').default(0).notNull(),
        dailyLastClaim: timestamp('daily_last_claim'),
        currentJob: text('current_job'),
        currentJobShifts: integer('current_job_shifts').default(0).notNull(),
        workShiftsDone: integer('work_shifts_done').default(0).notNull(),
        workLastShift: timestamp('work_last_shift'),
        workStreak: integer('work_streak').default(0).notNull(),
        workStreakDate: timestamp('work_streak_date'),
        casinoGamesPlayed: integer('casino_games_played').default(0).notNull(),
        casinoWins: integer('casino_wins').default(0).notNull(),
        casinoLosses: integer('casino_losses').default(0).notNull(),
        modKicks: integer('mod_kicks').default(0).notNull(),
        modBans: integer('mod_bans').default(0).notNull(),
        modMutes: integer('mod_mutes').default(0).notNull(),
        bonusXpUntil: timestamp('bonus_xp_until'),
        bonusMoneyUntil: timestamp('bonus_money_until'),
        robLastAttempt: timestamp('rob_last_attempt'),
        equippedTitle: text('equipped_title'),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
    },
    (table) => {
        return {
            userGuildUnique: uniqueIndex('user_guild_unique').on(
                table.discordId,
                table.guildId
            ),
        };
    }
);

export const guildSettings = pgTable('guild_settings', {
    id: serial('id').primaryKey(),
    guildId: text('guild_id').notNull().unique(),
    language: text('language').default('en').notNull(),
    modLogChannel: text('mod_log_channel'),
    maxWarns: integer('max_warns').default(3).notNull(),
    modLogWarning: boolean('mod_log_warning').default(true).notNull(),
    autoModEnabled: boolean('auto_mod_enabled').default(false).notNull(),
    levelRoleId: text('level_role_id'),
    levelRoleThreshold: integer('level_role_threshold'),
    leaderboardChannel: text('leaderboard_channel'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const warns = pgTable(
    'warns',
    {
        id: serial('id').primaryKey(),
        guildId: text('guild_id').notNull(),
        userId: text('user_id').notNull(),
        moderatorId: text('moderator_id').notNull(),
        reason: text('reason').notNull(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
    },
    (table) => {
        return {
            guildUserIdx: index('warns_guild_user_idx').on(
                table.guildId,
                table.userId
            ),
        };
    }
);

export const reminders = pgTable(
    'reminders',
    {
        id: serial('id').primaryKey(),
        userId: text('user_id').notNull(),
        channelId: text('channel_id').notNull(),
        message: text('message').notNull(),
        remindAt: timestamp('remind_at').notNull(),
        repeatMinutes: integer('repeat_minutes'),
        createdAt: timestamp('created_at').defaultNow().notNull(),
    },
    (table) => {
        return {
            remindAtIdx: index('reminders_remind_at_idx').on(table.remindAt),
        };
    }
);

export const guildEventChannels = pgTable('guild_event_channels', {
    id: serial('id').primaryKey(),
    guildId: text('guild_id').notNull(),
    channelId: text('channel_id').notNull(),
});

export const userQuests = pgTable(
    'user_quests',
    {
        id: serial('id').primaryKey(),
        userId: text('user_id').notNull(),
        guildId: text('guild_id').notNull(),
        questId: text('quest_id').notNull(),
        progress: integer('progress').default(0).notNull(),
        target: integer('target').notNull(),
        type: text('type').notNull(), // 'daily' | 'weekly'
        completed: boolean('completed').default(false).notNull(),
        expiresAt: timestamp('expires_at').notNull(),
    },
    (table) => {
        return {
            userGuildIncompleteIdx: index('user_quests_user_guild_idx').on(
                table.userId,
                table.guildId,
                table.completed
            ),
            typeIdx: index('user_quests_type_idx').on(table.type),
        };
    }
);

export const interactionStats = pgTable(
    'interaction_stats',
    {
        id: serial('id').primaryKey(),
        userId: text('user_id').notNull(),
        guildId: text('guild_id').notNull(),
        interactionType: text('interaction_type').notNull(), // e.g. 'hug', 'kiss', 'pat'
        count: integer('count').default(0).notNull(),
    },
    (table) => {
        return {
            userInteractionUnique: uniqueIndex('user_interaction_unique').on(
                table.userId,
                table.guildId,
                table.interactionType
            ),
        };
    }
);

export const modActions = pgTable(
    'mod_actions',
    {
        id: serial('id').primaryKey(),
        guildId: text('guild_id').notNull(),
        userId: text('user_id').notNull(),
        moderatorId: text('moderator_id').notNull(),
        actionType: text('action_type').notNull(), // 'BAN', 'KICK', 'MUTE', 'WARN', 'UNMUTE', 'SOFTBAN', etc.
        reason: text('reason').notNull(),
        expiresAt: timestamp('expires_at'),
        createdAt: timestamp('created_at').defaultNow().notNull(),
    },
    (table) => {
        return {
            guildUserIdx: index('mod_actions_guild_user_idx').on(
                table.guildId,
                table.userId
            ),
        };
    }
);

export const transactions = pgTable(
    'transactions',
    {
        id: serial('id').primaryKey(),
        userId: text('user_id').notNull(),
        guildId: text('guild_id').notNull(),
        type: text('type').notNull(), // 'daily', 'work', 'rob', 'pay', 'casino', 'bank_deposit', 'bank_withdraw', etc.
        amount: integer('amount').notNull(), // Can be positive or negative
        details: text('details'), // Extra info like 'Paid user 123', 'Robbed 456'
        createdAt: timestamp('created_at').defaultNow().notNull(),
    },
    (table) => {
        return {
            userGuildIdx: index('transactions_user_guild_idx').on(
                table.userId,
                table.guildId,
                table.createdAt
            ),
            createdAtIdx: index('transactions_created_at_idx').on(
                table.createdAt
            ),
        };
    }
);

export const userInventory = pgTable(
    'user_inventory',
    {
        id: serial('id').primaryKey(),
        discordId: text('discord_id').notNull(),
        guildId: text('guild_id').notNull(),
        itemKey: text('item_key').notNull(),
        purchasedAt: timestamp('purchased_at').defaultNow().notNull(),
    },
    (table) => {
        return {
            userItemUnique: uniqueIndex('user_inventory_item_unique').on(
                table.discordId,
                table.guildId,
                table.itemKey
            ),
            userGuildIdx: index('user_inventory_user_guild_idx').on(
                table.discordId,
                table.guildId
            ),
        };
    }
);

// Marriages are global (not scoped to a guild) so /marry works the same way
// in DMs as in a server â€” a user has at most one spouse across the whole bot.
export const marriages = pgTable(
    'marriages',
    {
        id: serial('id').primaryKey(),
        user1Id: text('user1_id').notNull(),
        user2Id: text('user2_id').notNull(),
        marriedAt: timestamp('married_at').defaultNow().notNull(),
    },
    (table) => {
        return {
            user1Idx: index('marriages_user1_idx').on(table.user1Id),
            user2Idx: index('marriages_user2_idx').on(table.user2Id),
        };
    }
);

// Cumulative per-channel message counters, used to surface the most/least
// active text channels in a server (bot command + admin panel).
export const channelActivity = pgTable(
    'channel_activity',
    {
        id: serial('id').primaryKey(),
        guildId: text('guild_id').notNull(),
        channelId: text('channel_id').notNull(),
        messageCount: integer('message_count').default(0).notNull(),
        lastMessageAt: timestamp('last_message_at'),
    },
    (table) => {
        return {
            guildChannelUnique: uniqueIndex(
                'channel_activity_guild_channel_unique'
            ).on(table.guildId, table.channelId),
            guildIdx: index('channel_activity_guild_idx').on(table.guildId),
        };
    }
);

// Message counts bucketed by UTC hour-of-day (0-23), used to find a
// server's peak/quiet activity hours.
export const activityHourly = pgTable(
    'activity_hourly',
    {
        id: serial('id').primaryKey(),
        guildId: text('guild_id').notNull(),
        hour: integer('hour').notNull(),
        messageCount: integer('message_count').default(0).notNull(),
    },
    (table) => {
        return {
            guildHourUnique: uniqueIndex(
                'activity_hourly_guild_hour_unique'
            ).on(table.guildId, table.hour),
        };
    }
);

// Cumulative per-voice-channel time tracking. currentCount is maintained by
// the bot's voiceStateUpdate handler so the panel-server (which has no
// gateway connection) can still show a near-live "members in voice" figure.
export const voiceChannelStats = pgTable(
    'voice_channel_stats',
    {
        id: serial('id').primaryKey(),
        guildId: text('guild_id').notNull(),
        channelId: text('channel_id').notNull(),
        totalSeconds: integer('total_seconds').default(0).notNull(),
        sessionCount: integer('session_count').default(0).notNull(),
        currentCount: integer('current_count').default(0).notNull(),
    },
    (table) => {
        return {
            guildChannelUnique: uniqueIndex(
                'voice_channel_stats_guild_channel_unique'
            ).on(table.guildId, table.channelId),
            guildIdx: index('voice_channel_stats_guild_idx').on(table.guildId),
        };
    }
);

export const giveaways = pgTable(
    'giveaways',
    {
        id: serial('id').primaryKey(),
        guildId: text('guild_id').notNull(),
        channelId: text('channel_id').notNull(),
        messageId: text('message_id'),
        hostId: text('host_id').notNull(),
        prize: text('prize').notNull(),
        winnerCount: integer('winner_count').default(1).notNull(),
        requiredRoleId: text('required_role_id'),
        status: text('status').default('active').notNull(), // 'active' | 'ended'
        endsAt: timestamp('ends_at').notNull(),
        endedAt: timestamp('ended_at'),
        createdAt: timestamp('created_at').defaultNow().notNull(),
    },
    (table) => {
        return {
            statusEndsAtIdx: index('giveaways_status_ends_at_idx').on(
                table.status,
                table.endsAt
            ),
        };
    }
);

export const giveawayEntries = pgTable(
    'giveaway_entries',
    {
        id: serial('id').primaryKey(),
        giveawayId: integer('giveaway_id').notNull(),
        userId: text('user_id').notNull(),
        enteredAt: timestamp('entered_at').defaultNow().notNull(),
    },
    (table) => {
        return {
            giveawayUserUnique: uniqueIndex(
                'giveaway_entries_giveaway_user_unique'
            ).on(table.giveawayId, table.userId),
        };
    }
);

export const giveawayWinners = pgTable(
    'giveaway_winners',
    {
        id: serial('id').primaryKey(),
        giveawayId: integer('giveaway_id').notNull(),
        userId: text('user_id').notNull(),
        rerolled: boolean('rerolled').default(false).notNull(),
        wonAt: timestamp('won_at').defaultNow().notNull(),
    },
    (table) => {
        return {
            giveawayIdx: index('giveaway_winners_giveaway_idx').on(
                table.giveawayId
            ),
        };
    }
);

export const stocks = pgTable('stocks', {
    id: serial('id').primaryKey(),
    ticker: text('ticker').notNull().unique(),
    name: text('name').notNull(),
    price: integer('price').notNull(),
    previousPrice: integer('previous_price').notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const userHoldings = pgTable(
    'user_holdings',
    {
        id: serial('id').primaryKey(),
        discordId: text('discord_id').notNull(),
        guildId: text('guild_id').notNull(),
        ticker: text('ticker').notNull(),
        quantity: integer('quantity').default(0).notNull(),
        avgBuyPrice: integer('avg_buy_price').default(0).notNull(),
    },
    (table) => {
        return {
            userTickerUnique: uniqueIndex(
                'user_holdings_user_ticker_unique'
            ).on(table.discordId, table.guildId, table.ticker),
        };
    }
);

// Price snapshots recorded on every StockPriceJob tick, used to render the
// line chart in /invest chart. Not scoped per-guild since stock prices are
// global.
export const stockPriceHistory = pgTable(
    'stock_price_history',
    {
        id: serial('id').primaryKey(),
        ticker: text('ticker').notNull(),
        price: integer('price').notNull(),
        recordedAt: timestamp('recorded_at').defaultNow().notNull(),
    },
    (table) => {
        return {
            tickerRecordedIdx: index(
                'stock_price_history_ticker_recorded_idx'
            ).on(table.ticker, table.recordedAt),
        };
    }
);
