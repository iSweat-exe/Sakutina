import { ShardingManager } from 'discord.js';
import { join } from 'node:path';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';

const botPath = join(process.cwd(), 'src', 'bot.ts');

// This is the parent process that forks one child process per shard (bot.ts).
// It has no supervisor of its own beyond the OS/Docker restart policy, so it
// needs the same last-resort safety nets as bot.ts to avoid dying silently.
process.on('unhandledRejection', (reason) => {
    logger.error('[ShardingManager process] Unhandled Rejection:', reason);
});
process.on('uncaughtException', (error) => {
    logger.error('[ShardingManager process] Uncaught Exception:', error);
    process.exit(1);
});

const manager = new ShardingManager(botPath, {
    token: env.DISCORD_TOKEN,
    respawn: true,
    totalShards: 'auto',
    execArgv: ['--bun'],
});

manager.on('shardCreate', (shard) => {
    logger.info(`[ShardingManager] Launching Shard #${shard.id}`);

    shard.on('error', (error) => {
        logger.error(`[Shard ${shard.id}] Error:`, error);
    });
    shard.on('death', () => {
        logger.warn(`[Shard ${shard.id}] Process died, respawn expected.`);
    });
});

manager
    .spawn()
    .then(() =>
        logger.info('[ShardingManager] All shards launched successfully.')
    )
    .catch((error) => logger.error('[ShardingManager] Launch failed:', error));
