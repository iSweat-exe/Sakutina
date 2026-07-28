import {
    ChatInputCommandInteraction,
    MessageFlags,
    SlashCommandBuilder,
} from 'discord.js';
import type { Command } from '../../../types/Command.js';
import { I18nService } from '../../../services/I18nService.js';
import { GuildConfigService } from '../../../services/GuildConfigService.js';
import { EconomyService } from '../../../services/EconomyService.js';
import { EmbedUtils } from '../../../utils/EmbedUtils.js';
import { CooldownError } from '../../../utils/errors.js';
import { DAILY_REWARD } from '../constants.js';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setNameLocalizations({ fr: 'journalier' })
        .setDescription('Claim your daily reward')
        .setDescriptionLocalizations({
            fr: 'Réclamer votre récompense journalière',
        }),
    async execute(interaction: ChatInputCommandInteraction) {
        const lang = await GuildConfigService.getGuildLanguage(
            interaction.guildId
        );

        try {
            // User choice: default is 500
            const newBalance = await EconomyService.claimDaily(
                interaction.user.id,
                DAILY_REWARD
            );
            const msg = I18nService.translate('common:DAILY_SUCCESS', {
                lng: lang,
                amount: DAILY_REWARD,
                balance: newBalance,
            });
            const embed = EmbedUtils.success(
                msg,
                'Daily Reward',
                interaction.user
            );
            await interaction.reply({ embeds: [embed] });
        } catch (error: unknown) {
            if (error instanceof CooldownError) {
                const msg = I18nService.translate('common:DAILY_COOLDOWN', {
                    lng: lang,
                    hours: error.remaining,
                });
                const embed = EmbedUtils.warn(
                    msg,
                    'Cooldown',
                    interaction.user
                );
                await interaction.reply({
                    embeds: [embed],
                    flags: MessageFlags.Ephemeral,
                });
            } else {
                const msg = I18nService.translate('common:ERROR_GENERIC', {
                    lng: lang,
                });
                const embed = EmbedUtils.error(msg, 'Error', interaction.user);
                await interaction.reply({
                    embeds: [embed],
                    flags: MessageFlags.Ephemeral,
                });
            }
        }
    },
};

export default command;
