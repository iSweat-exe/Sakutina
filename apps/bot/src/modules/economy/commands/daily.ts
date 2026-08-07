import {
    ChatInputCommandInteraction,
    MessageFlags,
    SlashCommandBuilder,
} from 'discord.js';
import type { Command } from '@/types/Command.js';
import { I18nService } from '@/services/I18nService.js';
import { EconomyService } from '@/services/EconomyService.js';
import { MarriageService } from '@/services/MarriageService.js';
import { EmbedUtils } from '@/utils/EmbedUtils.js';
import { createCommandHandler } from '@/utils/index.js';
import { CooldownError } from '@/utils/errors.js';
import { DAILY_REWARD } from '../constants.js';

/** Bonus multiplier applied to the daily reward for married users */
const MARRIAGE_DAILY_BONUS = 1.1;

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Claim your daily reward')
        .setDescriptionLocalizations({
            fr: 'Réclamer votre récompense journalière',
        }),
    execute: createCommandHandler(
        async (interaction: ChatInputCommandInteraction, lang: string) => {
            const guildId = interaction.guildId ?? 'dm';
            const married = await MarriageService.isMarried(
                interaction.user.id
            );
            const amount = married
                ? Math.floor(DAILY_REWARD * MARRIAGE_DAILY_BONUS)
                : DAILY_REWARD;
            try {
                const newBalance = await EconomyService.claimDaily(
                    interaction.user.id,
                    guildId,
                    amount
                );
                const msg = I18nService.translate('economy:DAILY_SUCCESS', {
                    lng: lang,
                    amount,
                    balance: newBalance,
                });
                const embed = EmbedUtils.success(
                    msg,
                    'Daily Reward',
                    interaction.user
                );
                await interaction.reply({ embeds: [embed] });
            } catch (error: unknown) {
                const msg =
                    error instanceof CooldownError
                        ? I18nService.translate('economy:DAILY_COOLDOWN', {
                              lng: lang,
                              ...error.meta,
                          })
                        : I18nService.translate('common:ERROR_GENERIC', {
                              lng: lang,
                          });
                const embed = EmbedUtils.error(msg, 'Error', interaction.user);
                await interaction.reply({
                    embeds: [embed],
                    flags: MessageFlags.Ephemeral,
                });
            }
        }
    ),
};

export default command;
