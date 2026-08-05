import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../../types/Command.js';
import { I18nService } from '../../../services/I18nService.js';
import { EmbedUtils } from '../../../utils/EmbedUtils.js';
import { createCommandHandler } from '../../../utils/index.js';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('8ball')
        .setDescription('Ask the magic 8ball a question')
        .setDescriptionLocalizations({
            fr: 'Poser une question à la boule magique',
        })
        .addStringOption((option) =>
            option
                .setName('question')
                .setDescription('The question you want to ask')
                .setDescriptionLocalizations({
                    fr: 'La question que vous voulez poser',
                })
                .setRequired(true)
        ),
    execute: createCommandHandler(
        async (interaction: ChatInputCommandInteraction, lang: string) => {
            const question = interaction.options.getString('question', true);

            const answers = I18nService.translate('fun:8BALL_ANSWERS', {
                lng: lang,
                returnObjects: true,
            }) as unknown as string[];

            const answer = answers[Math.floor(Math.random() * answers.length)];

            const embed = EmbedUtils.base({
                title: I18nService.translate('fun:8BALL_TITLE', { lng: lang }),
                user: interaction.user,
            }).addFields(
                {
                    name: `ðŸŽ± ${I18nService.translate('fun:8BALL_QUESTION', { lng: lang })}`,
                    value: question,
                },
                {
                    name: `ðŸŽ± ${I18nService.translate('fun:8BALL_RESPONSE', { lng: lang })}`,
                    value: answer || '...',
                }
            );

            await interaction.reply({ embeds: [embed] });
        }
    ),
};

export default command;
