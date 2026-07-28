import { Events, Message } from 'discord.js';
import { GuildConfigService } from '../services/GuildConfigService.js';
import { EventService } from '../services/EventService.js';
import { logger } from '../utils/logger.js';

export default {
    name: Events.MessageCreate,
    async execute(message: Message) {
        if (message.author.bot || !message.guildId) return;

        try {
            const eventChannels = await GuildConfigService.getEventChannels(message.guildId);
            if (eventChannels.includes(message.channelId)) {
                await EventService.maybeTriggerEvent(message);
            }
        } catch (error) {
            logger.error('[MessageCreate] Error handling message', error);
        }
    },
};
