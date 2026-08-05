import { createCommandHandler } from '../../../utils/index.js';
import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../../types/Command.js';
import { I18nService } from '../../../services/I18nService.js';
import { EconomyService } from '../../../services/EconomyService.js';
import { EmbedUtils } from '../../../utils/EmbedUtils.js';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('View the richest users')
        .setDescriptionLocalizations({
            fr: 'Voir les utilisateurs les plus riches',
        }),
    execute: createCommandHandler(
        async (interaction: ChatInputCommandInteraction, lang: string) => {
            const guildId = interaction.guildId ?? 'dm';
            const topUsers = await EconomyService.getLeaderboard(guildId, 10);
            const title = I18nService.translate('economy:LEADERBOARD_TITLE', {
                lng: lang,
            });
            const emptyMsg = I18nService.translate(
                'economy:LEADERBOARD_EMPTY',
                {
                    lng: lang,
                }
            );
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
        }
    ),
};

export default command;
