import { createCommandHandler } from '../../../utils/index.js';
import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    SlashCommandBuilder,
} from 'discord.js';
import type { Command } from '../../../types/Command.js';
import { I18nService } from '../../../services/I18nService.js';
import { GuildConfigService } from '../../../services/GuildConfigService.js';
import { EconomyService } from '../../../services/EconomyService.js';
import { EmbedUtils } from '../../../utils/EmbedUtils.js';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setNameLocalizations({ fr: 'classement' })
        .setDescription('View the richest users')
        .setDescriptionLocalizations({
            fr: 'Voir les utilisateurs les plus riches',
        }),
    execute: createCommandHandler(async (interaction: ChatInputCommandInteraction, lang: string) => {
        // We get top 10 users globally.
        // In a multi-server setup, you might want this scoped per guild if money is per-guild.
        // But currently economy is global per user.
        const topUsers = await EconomyService.getLeaderboard(10);
        const title = I18nService.translate('common:LEADERBOARD_TITLE', {
            lng: lang,
        });
        const emptyMsg = I18nService.translate('common:LEADERBOARD_EMPTY', {
            lng: lang,
        });
        const embed = EmbedUtils.base({
            title,
            color: '#FFD700',
            user: interaction.user,
        });
        if (topUsers.length === 0) {
            embed.setDescription(emptyMsg);
        } else {
            let description = '';
            for (let i = 0; i < topUsers.length; i++) {
                const u = topUsers[i]!;
                description += `**${i + 1}.** <@${u.discordId}> - ${u.total} \n`;
            }
            embed.setDescription(description);
        }
        await interaction.reply({ embeds: [embed] });
    }),
};

export default command;
