import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../../types/Command.js';
import { I18nService } from '../../../services/I18nService.js';
import { EmbedUtils } from '../../../utils/EmbedUtils.js';
import { createCommandHandler } from '../../../utils/index.js';
import { env } from '../../../config/env.js';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('ask')
        .setDescription('Ask the AI a question')
        .setDescriptionLocalizations({ fr: "Poser une question à  l'IA" })
        .addStringOption((option) =>
            option
                .setName('prompt')
                .setDescription('The question or prompt for the AI')
                .setDescriptionLocalizations({ fr: "La question pour l'IA" })
                .setRequired(true)
        ),
    execute: createCommandHandler(
        async (interaction: ChatInputCommandInteraction, lang: string) => {
            if (!env.OPENAI_API_KEY) {
                const msg = I18nService.translate('common:AI_UNAVAILABLE', {
                    lng: lang,
                });
                const embed = EmbedUtils.warn(
                    msg,
                    I18nService.translate('common:EMBED_TITLE_AI', {
                        lng: lang,
                    }),
                    interaction.user
                );
                await interaction.reply({ embeds: [embed] });
                return;
            }

            const prompt = interaction.options.getString('prompt', true);
            await interaction.deferReply();

            try {
                // Placeholder logic to call OpenAI API
                // const response = await fetch('https://api.openai.com/v1/chat/completions', { ... });
                // For now, we simulate a delay.

                await new Promise((resolve) => setTimeout(resolve, 1500));

                const msg = I18nService.translate('common:AI_SIMULATION', {
                    lng: lang,
                    prompt,
                });

                await interaction.followUp({ content: msg });
            } catch (error) {
                const embed = EmbedUtils.error(
                    I18nService.translate('common:ERR_COMMAND_EXECUTION', {
                        lng: lang,
                    }),
                    I18nService.translate('common:EMBED_TITLE_ERROR', {
                        lng: lang,
                    }),
                    interaction.user
                );
                await interaction.followUp({ embeds: [embed] });
            }
        }
    ),
};

export default command;
