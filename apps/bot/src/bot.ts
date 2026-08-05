import { Client, GatewayIntentBits } from 'discord.js';
import { join } from 'node:path';
import { CommandLoader } from './core/CommandLoader.js';
import { EventLoader } from './core/EventLoader.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { closeDb } from '@sakutina/db';
import { closeRedis } from '@sakutina/cache';
import { VoiceTrackingService } from './services/VoiceTrackingService.js';
import { BankInterestJob } from './jobs/BankInterestJob.js';
import { ReminderJob } from './jobs/ReminderJob.js';
import { QuestResetJob } from './jobs/QuestResetJob.js';
import { TransactionCleanupJob } from './jobs/TransactionCleanupJob.js';
import { WeeklyLeaderboardJob } from './jobs/WeeklyLeaderboardJob.js';

// Extended client to attach commands
export class BotClient extends Client {
    public commandLoader: CommandLoader;

    constructor() {
        super({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildVoiceStates,
            ],
        });
        this.commandLoader = new CommandLoader();
    }
}

export const botClient = new BotClient();

// discord.js emits 'error' on the client whenever the underlying WebSocket
// connection has an issue. EventEmitter throws synchronously if 'error' has
// no listener, which would otherwise crash the process on every gateway
// hiccup â€” so this listener alone is critical, not just for visibility.
botClient.on('error', (error) => {
    logger.error('[Client] WebSocket error:', error);
});
botClient.on('shardError', (error, shardId) => {
    logger.error(`[Client] Shard ${shardId} error:`, error);
});
botClient.on('warn', (message) => {
    logger.warn(`[Client] ${message}`);
});

const start = async () => {
    try {
        const modulesPath = join(process.cwd(), 'src', 'modules'); //TODO: use import.meta.dir
        await botClient.commandLoader.loadCommands(modulesPath);

        const eventLoader = new EventLoader();
        const eventsPath = join(process.cwd(), 'src', 'events'); //TODO: use import.meta.dir
        await eventLoader.loadEvents(eventsPath, botClient);

        // Start Jobs
        BankInterestJob.start();
        ReminderJob.start();
        QuestResetJob.start();
        TransactionCleanupJob.start();
        WeeklyLeaderboardJob.start();

        await botClient.login(env.DISCORD_TOKEN);
    } catch (error) {
        logger.error('Failed to start the bot:', error);
        process.exit(1);
    }
};

const shutdown = async (signal: string) => {
    logger.info(`[${signal}] Graceful shutdown initiated...`);

    try {
        await VoiceTrackingService.flushAll();
    } catch (error) {
        logger.error('Error flushing voice tracking sessions:', error);
    }

    try {
        await closeDb();
        logger.info('Database connection closed.');
    } catch (error) {
        logger.error('Error closing database connection:', error);
    }

    try {
        await closeRedis();
        logger.info('Redis connection closed.');
    } catch (error) {
        logger.error('Error closing Redis connection:', error);
    }

    botClient.destroy();
    logger.info('Discord client disconnected. Process exited.');
    process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    // Per Node's own guidance, it's not safe to keep running after a truly
    // uncaught exception â€” the process (and any Discord.js internal state)
    // may be corrupted. ShardingManager (respawn: true) and the Docker
    // restart policy both bring a fresh, clean process back up within
    // seconds, which is safer than silently limping along indefinitely.
    process.exit(1);
});

start();
