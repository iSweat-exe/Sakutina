import { Events, VoiceState } from 'discord.js';
import { VoiceTrackingService } from '../services/VoiceTrackingService.js';
import { logger } from '../utils/logger.js';

export default {
    name: Events.VoiceStateUpdate,
    async execute(oldState: VoiceState, newState: VoiceState) {
        try {
            await VoiceTrackingService.handleVoiceStateUpdate(
                oldState,
                newState
            );
        } catch (error) {
            logger.error(
                '[VoiceStateUpdate] Error handling voice state update',
                error
            );
        }
    },
};
