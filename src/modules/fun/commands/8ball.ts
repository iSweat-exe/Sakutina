import { ChatInputCommandInteraction, SlashCommandBuilder, Colors } from 'discord.js';
import type { Command } from '../../../types/Command.js';
import { I18nService } from '../../../services/I18nService.js';
import { EmbedUtils } from '../../../utils/EmbedUtils.js';
import { createCommandHandler } from '../../../utils/index.js';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('8ball')
        .setDescription('Ask the magic 8ball a question')
        .setNameLocalizations({ fr: '8ball' })
        .setDescriptionLocalizations({ fr: 'Poser une question à la boule magique' })
        .addStringOption((option) =>
            option
                .setName('question')
                .setDescription('The question you want to ask')
                .setNameLocalizations({ fr: 'question' })
                .setDescriptionLocalizations({ fr: 'La question que vous voulez poser' })
                .setRequired(true)
        ),
    execute: createCommandHandler(async (interaction: ChatInputCommandInteraction, lang: string) => {
        const question = interaction.options.getString('question', true);

        const answers = I18nService.translate('common:8BALL_ANSWERS', {
            lng: lang,
            returnObjects: true
        }) as unknown as string[];

        const answer = answers[Math.floor(Math.random() * answers.length)];

        const embed = EmbedUtils.base({
            title: I18nService.translate('common:8BALL_TITLE', { lng: lang }),
            user: interaction.user,
        })
            .addFields(
                {
                    name: `🎱 ${I18nService.translate('common:8BALL_QUESTION', { lng: lang })}`,
                    value: question,
                },
                {
                    name: `🎱 ${I18nService.translate('common:8BALL_RESPONSE', { lng: lang })}`,
                    value: answer || '...',
                }
            );

        await interaction.reply({ embeds: [embed] });
    }),
};

export default command;
