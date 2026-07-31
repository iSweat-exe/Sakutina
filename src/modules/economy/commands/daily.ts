import {
    ChatInputCommandInteraction,
    MessageFlags,
    SlashCommandBuilder,
} from 'discord.js';
import type { Command } from '../../../types/Command.js';
import { I18nService } from '../../../services/I18nService.js';
import { EconomyService } from '../../../services/EconomyService.js';
import { EmbedUtils } from '../../../utils/EmbedUtils.js';
import { createCommandHandler } from '../../../utils/index.js';
import { DAILY_REWARD } from '../constants.js';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setNameLocalizations({ fr: 'journalier' })
        .setDescription('Claim your daily reward')
        .setDescriptionLocalizations({
            fr: 'Réclamer votre récompense journalière',
        }),
    execute: createCommandHandler(async (interaction: ChatInputCommandInteraction, lang: string) => {
        const guildId = interaction.guildId ?? 'dm';
        // User choice: default is 500
        const newBalance = await EconomyService.claimDaily(interaction.user.id, guildId, DAILY_REWARD);
        const msg = I18nService.translate('economy:DAILY_SUCCESS', {
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
    }),
};

export default command;
