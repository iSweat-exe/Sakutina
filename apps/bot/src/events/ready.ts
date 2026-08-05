import type { Client } from 'discord.js';
import type { Event } from '../types/Event.js';
import { logger } from '../utils/logger.js';
import { checkDbConnection } from '@sakutina/db';
import { checkRedisConnection } from '@sakutina/cache';
import { PresenceService } from '../services/PresenceService.js';
import { VoiceTrackingService } from '../services/VoiceTrackingService.js';

const event: Event<'clientReady'> = {
    name: 'clientReady',
    once: true,
    async execute(client: Client) {
        logger.info(`[Ready] Logged in as ${client.user?.tag}`);
        await checkDbConnection();
        await checkRedisConnection();
        PresenceService.start(client);
        await VoiceTrackingService.seedFromClient(client).catch((err) => {
            logger.error('[Ready] Failed to seed voice tracking state', err);
        });
    },
};

export default event;


