import { createCommandHandler } from '../../../utils/index.js';
import { MessageFlags } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../../types/Command.js';
import { I18nService } from '../../../services/I18nService.js';
import { EmbedUtils } from '../../../utils/EmbedUtils.js';
import { env } from '../../../config/env.js';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('panel')
        .setDescription('Get a link to the web admin panel')
        .setDescriptionLocalizations({
            fr: "Obtenir le lien du panneau d'administration web",
        }),
    execute: createCommandHandler(
        async (interaction: ChatInputCommandInteraction, lang: string) => {
            const title = I18nService.translate('common:EMBED_TITLE_PANEL', {
                lng: lang,
            });

            const embed = env.PANEL_URL
                ? EmbedUtils.info(
                      I18nService.translate('common:PANEL_LINK', {
                          lng: lang,
                          url: env.PANEL_URL,
                      }),
                      title,
                      interaction.user
                  )
                : EmbedUtils.warn(
                      I18nService.translate('common:PANEL_COMING_SOON', {
                          lng: lang,
                      }),
                      title,
                      interaction.user
                  );

            await interaction.reply({
                embeds: [embed],
                flags: MessageFlags.Ephemeral,
            });
        }
    ),
};

export default command;
