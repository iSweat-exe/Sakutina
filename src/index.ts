import { ShardingManager } from 'discord.js';
import { join } from 'node:path';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';

const botPath = join(process.cwd(), 'src', 'bot.ts');

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
});

manager
    .spawn()
    .then(() =>
        logger.info('[ShardingManager] All shards launched successfully.')
    )
    .catch((error) => logger.error('[ShardingManager] Launch failed:', error));
