import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../../types/Command.js';
import { I18nService } from '../../../services/I18nService.js';
import { EmbedUtils } from '../../../utils/EmbedUtils.js';
import { createCommandHandler } from '../../../utils/index.js';
import { db, reminders } from '@sakutina/db';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('remindme')
        .setDescription('Set a reminder')
        .setDescriptionLocalizations({ fr: 'Définir un rappel' })
        .addStringOption((option) =>
            option
                .setName('message')
                .setDescription('The message to remind you of')
                .setDescriptionLocalizations({
                    fr: 'Le message à vous rappeler',
                })
                .setRequired(true)
        )
        .addIntegerOption(
            (option) =>
                option
                    .setName('duration')
                    .setDescription('Duration until reminder (in minutes)')
                    .setDescriptionLocalizations({
                        fr: 'Durée avant le rappel (en minutes)',
                    })
                    .setRequired(true)
                    .setMinValue(1)
                    .setMaxValue(525600) // Max 1 year
        )
        .addIntegerOption((option) =>
            option
                .setName('repeat')
                .setDescription(
                    'Repeat this reminder every N minutes (optional)'
                )
                .setDescriptionLocalizations({
                    fr: 'Répéter ce rappel toutes les N minutes (optionnel)',
                })
                .setRequired(false)
                .setMinValue(5)
                .setMaxValue(525600)
        ),
    execute: createCommandHandler(
        async (interaction: ChatInputCommandInteraction, lang: string) => {
            const message = interaction.options.getString('message', true);
            const duration = interaction.options.getInteger('duration', true);
            const repeatMinutes = interaction.options.getInteger('repeat');

            const remindAt = new Date();
            remindAt.setMinutes(remindAt.getMinutes() + duration);

            await db.insert(reminders).values({
                userId: interaction.user.id,
                channelId: interaction.channelId,
                message,
                remindAt,
                repeatMinutes: repeatMinutes ?? null,
            });

            let msg = I18nService.translate('common:REMINDER_SET_SUCCESS', {
                lng: lang,
                message,
                duration,
            });
            if (repeatMinutes) {
                msg +=
                    ' ' +
                    I18nService.translate('common:REMINDER_REPEAT_SUFFIX', {
                        lng: lang,
                        minutes: repeatMinutes,
                    });
            }
            const embed = EmbedUtils.success(
                msg,
                I18nService.translate('common:EMBED_TITLE_REMINDER_SET', {
                    lng: lang,
                }),
                interaction.user
            );
            await interaction.reply({ embeds: [embed] });
        }
    ),
};

export default command;
