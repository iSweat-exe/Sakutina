import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { GuildConfigService } from '../services/GuildConfigService.js';
import { I18nService } from '../services/I18nService.js';
import { EmbedUtils } from './EmbedUtils.js';
import { AppError } from './errors.js';

export interface CommandHandlerOptions {
    defer?: boolean;
    ephemeral?: boolean;
}

export function createCommandHandler(
    handler: (
        interaction: ChatInputCommandInteraction,
        lang: string
    ) => Promise<void>,
    options?: CommandHandlerOptions
) {
    return async (interaction: ChatInputCommandInteraction) => {
        if (options?.defer) {
            await interaction.deferReply({
                flags: options.ephemeral ? MessageFlags.Ephemeral : undefined,
            });
        }
        const lang = await GuildConfigService.getGuildLanguage(
            interaction.guildId
        );
        try {
            await handler(interaction, lang);
        } catch (error) {
            if (error instanceof AppError) {
                const msg = I18nService.translate(`common:${error.code}`, {
                    lng: lang,
                    ...error.meta,
                });
                const embed = EmbedUtils.error(msg, 'Error', interaction.user);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({
                        embeds: [embed],
                        flags: MessageFlags.Ephemeral,
                    });
                } else {
                    await interaction.reply({
                        embeds: [embed],
                        flags: MessageFlags.Ephemeral,
                    });
                }
            } else {
                throw error; // → re-thrown vers le handler global dans interactionCreate.ts
            }
        }
    };
}
