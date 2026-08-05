import type { Interaction } from 'discord.js';
import type { BotClient } from '../bot.js';
import type { Event } from '../types/Event.js';
import { logger } from '../utils/logger.js';
import {
    MessageFlags,
    DiscordAPIError,
    type InteractionReplyOptions,
} from 'discord.js';
import { I18nService } from '../services/I18nService.js';
import { GuildConfigService } from '../services/GuildConfigService.js';

const event: Event<'interactionCreate'> = {
    name: 'interactionCreate',
    async execute(interaction: Interaction) {
        if (interaction.isAutocomplete()) {
            const client = interaction.client as BotClient;
            const command = client.commandLoader.commands.get(
                interaction.commandName
            );
            if (command && command.autocomplete) {
                try {
                    await command.autocomplete(interaction);
                } catch (error) {
                    logger.error(
                        `[Command:${interaction.commandName}] Autocomplete error:`,
                        error
                    );
                }
            }
            return;
        }

        if (!interaction.isChatInputCommand()) return;

        const client = interaction.client as BotClient;
        const command = client.commandLoader.commands.get(
            interaction.commandName
        );
        if (!command) {
            logger.warn(
                `[Command] Unknown command: ${interaction.commandName}`
            );
            return;
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            if (
                error instanceof DiscordAPIError &&
                (error.code === 10062 || error.code === 40060)
            ) {
                logger.warn(
                    `[Command:${interaction.commandName}] Interaction expired or already acknowledged.`
                );
                return;
            }

            logger.error(
                `[Command:${interaction.commandName}] Execution error:`,
                error
            );

            const lang = interaction.guildId
                ? await GuildConfigService.getGuildLanguage(interaction.guildId)
                : 'en';
            const replyPayload: InteractionReplyOptions = {
                content: I18nService.translate('common:ERR_COMMAND_EXECUTION', {
                    lng: lang,
                }),
                flags: MessageFlags.Ephemeral,
            };

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(replyPayload).catch(() => null);
            } else {
                await interaction.reply(replyPayload).catch(() => null);
            }
        }
    },
};

export default event;
