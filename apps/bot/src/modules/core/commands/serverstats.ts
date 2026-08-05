import { createCommandHandler } from '@/utils/index.js';
import {
    ChatInputCommandInteraction,
    MessageFlags,
    SlashCommandBuilder,
} from 'discord.js';
import type { Command } from '@/types/Command.js';
import { I18nService } from '@/services/I18nService.js';
import { ServerStatsService } from '@/services/ServerStatsService.js';
import { EmbedUtils } from '@/utils/EmbedUtils.js';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('serverstats')
        .setDescription('View server-wide activity and economy statistics')
        .setDescriptionLocalizations({
            fr: "Voir les statistiques d'activité et d'économie du serveur",
        }),
    execute: createCommandHandler(
        async (interaction: ChatInputCommandInteraction, lang: string) => {
            if (!interaction.guild) {
                const embed = EmbedUtils.error(
                    I18nService.translate('common:ERR_ONLY_SERVER', {
                        lng: lang,
                    }),
                    I18nService.translate('common:EMBED_TITLE_ERROR', {
                        lng: lang,
                    }),
                    interaction.user
                );
                await interaction.reply({
                    embeds: [embed],
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            const stats = await ServerStatsService.getStats(
                interaction.guild.id
            );
            const title = I18nService.translate('common:SERVERSTATS_TITLE', {
                lng: lang,
                server: interaction.guild.name,
            });
            const embed = EmbedUtils.base({
                title,
                color: '#3498DB',
                user: interaction.user,
            })
                .setThumbnail(interaction.guild.iconURL())
                .addFields(
                    {
                        name: I18nService.translate(
                            'common:SERVERSTATS_MEMBERS',
                            { lng: lang }
                        ),
                        value: `${interaction.guild.memberCount}`,
                        inline: true,
                    },
                    {
                        name: I18nService.translate(
                            'common:SERVERSTATS_TRACKED_USERS',
                            { lng: lang }
                        ),
                        value: `${stats.trackedUsers}`,
                        inline: true,
                    },
                    {
                        name: I18nService.translate(
                            'common:SERVERSTATS_TOTAL_WEALTH',
                            { lng: lang }
                        ),
                        value: `${stats.totalWealth} 💸`,
                        inline: true,
                    },
                    {
                        name: I18nService.translate(
                            'common:SERVERSTATS_AVG_WEALTH',
                            { lng: lang }
                        ),
                        value: `${stats.avgWealth} 💸`,
                        inline: true,
                    },
                    {
                        name: I18nService.translate(
                            'common:SERVERSTATS_TRANSACTIONS',
                            { lng: lang }
                        ),
                        value: `${stats.totalTransactions}`,
                        inline: true,
                    },
                    {
                        name: I18nService.translate(
                            'common:SERVERSTATS_WARNS',
                            { lng: lang }
                        ),
                        value: `${stats.totalWarns}`,
                        inline: true,
                    },
                    {
                        name: I18nService.translate(
                            'common:SERVERSTATS_MOD_ACTIONS',
                            { lng: lang }
                        ),
                        value: `${stats.totalModActions}`,
                        inline: true,
                    }
                );
            await interaction.reply({ embeds: [embed] });
        }
    ),
};

export default command;
