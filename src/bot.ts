import { Client, GatewayIntentBits } from 'discord.js';
import { join } from 'node:path';
import { CommandLoader } from './core/CommandLoader.js';
import { EventLoader } from './core/EventLoader.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { closeDb } from './repositories/db.js';

// Extended client to attach commands
export class BotClient extends Client {
    public commandLoader: CommandLoader;

    constructor() {
        super({ intents: [GatewayIntentBits.Guilds] });
        this.commandLoader = new CommandLoader();
    }
}

export const botClient = new BotClient();

const start = async () => {
    try {
        const modulesPath = join(process.cwd(), 'src', 'modules');
        await botClient.commandLoader.loadCommands(modulesPath);

        const eventLoader = new EventLoader();
        const eventsPath = join(process.cwd(), 'src', 'events');
        await eventLoader.loadEvents(eventsPath, botClient);

        await botClient.login(env.DISCORD_TOKEN);
    } catch (error) {
        logger.error('Failed to start the bot:', error);
        process.exit(1);
    }
};

const shutdown = async (signal: string) => {
    logger.info(`[${signal}] Graceful shutdown initiated...`);

    try {
        await closeDb();
        logger.info('Database connection closed.');
    } catch (error) {
        logger.error('Error closing database connection:', error);
    }

    botClient.destroy();
    logger.info('Discord client disconnected. Process exited.');
    process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection:', reason);
    // We log it but do not kill the process to maintain robustness
});

start();
