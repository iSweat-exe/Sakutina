import { createCommandHandler } from '@/utils/index.js';
import {
    ChatInputCommandInteraction,
    MessageFlags,
    SlashCommandBuilder,
} from 'discord.js';
import type { Command } from '@/types/Command.js';
import { I18nService } from '@/services/I18nService.js';
import { ActivityService } from '@/services/ActivityService.js';
import { EmbedUtils } from '@/utils/EmbedUtils.js';
import { formatLongDuration } from '@/utils/time.js';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('activity')
        .setDescription(
            'View channel traffic, voice usage, and peak activity hours'
        )
        .setDescriptionLocalizations({
            fr: "Voir le trafic des salons, l'usage vocal et les heures d'activité de pointe",
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

            const guild = interaction.guild;
            const noData = I18nService.translate('common:ACTIVITY_NO_DATA', {
                lng: lang,
            });

            const [channels, voiceChannels, hourly] = await Promise.all([
                ActivityService.getChannelActivity(guild.id),
                ActivityService.getVoiceChannelStats(guild.id),
                ActivityService.getHourlyActivity(guild.id),
            ]);

            const mostActiveChannel = channels[0] ?? null;
            const leastActiveChannel =
                channels.length > 0 ? channels[channels.length - 1] : null;

            const currentVoiceUsers = guild.channels.cache
                .filter((c) => c.isVoiceBased())
                .reduce(
                    (sum, c) => sum + c.members.filter((m) => !m.user.bot).size,
                    0
                );
            const totalVoiceSeconds = voiceChannels.reduce(
                (sum, v) => sum + v.totalSeconds,
                0
            );
            const mostActiveVoiceChannel = voiceChannels[0] ?? null;

            const hoursWithData = hourly.filter((h) => h.messageCount > 0);
            const peakHour =
                hoursWithData.length > 0
                    ? hoursWithData.reduce((a, b) =>
                          b.messageCount > a.messageCount ? b : a
                      )
                    : null;
            const quietHour =
                hoursWithData.length > 0
                    ? hoursWithData.reduce((a, b) =>
                          b.messageCount < a.messageCount ? b : a
                      )
                    : null;

            const title = I18nService.translate('common:ACTIVITY_TITLE', {
                lng: lang,
                server: guild.name,
            });

            const embed = EmbedUtils.base({
                title,
                color: '#3498DB',
                user: interaction.user,
            })
                .setThumbnail(guild.iconURL())
                .addFields(
                    {
                        name: I18nService.translate(
                            'common:ACTIVITY_MOST_ACTIVE_CHANNEL',
                            { lng: lang }
                        ),
                        value: mostActiveChannel
                            ? `<#${mostActiveChannel.channelId}> - ${I18nService.translate(
                                  'common:ACTIVITY_MESSAGE_COUNT',
                                  {
                                      lng: lang,
                                      count: mostActiveChannel.messageCount,
                                  }
                              )}`
                            : noData,
                        inline: true,
                    },
                    {
                        name: I18nService.translate(
                            'common:ACTIVITY_LEAST_ACTIVE_CHANNEL',
                            { lng: lang }
                        ),
                        value: leastActiveChannel
                            ? `<#${leastActiveChannel.channelId}> - ${I18nService.translate(
                                  'common:ACTIVITY_MESSAGE_COUNT',
                                  {
                                      lng: lang,
                                      count: leastActiveChannel.messageCount,
                                  }
                              )}`
                            : noData,
                        inline: true,
                    },
                    {
                        name: I18nService.translate(
                            'common:ACTIVITY_VOICE_NOW',
                            { lng: lang }
                        ),
                        value: I18nService.translate(
                            'common:ACTIVITY_VOICE_NOW_VALUE',
                            { lng: lang, count: currentVoiceUsers }
                        ),
                        inline: true,
                    },
                    {
                        name: I18nService.translate(
                            'common:ACTIVITY_VOICE_TOTAL_TIME',
                            { lng: lang }
                        ),
                        value: formatLongDuration(totalVoiceSeconds),
                        inline: true,
                    },
                    {
                        name: I18nService.translate(
                            'common:ACTIVITY_MOST_ACTIVE_VOICE_CHANNEL',
                            { lng: lang }
                        ),
                        value: mostActiveVoiceChannel
                            ? `<#${mostActiveVoiceChannel.channelId}> - ${formatLongDuration(mostActiveVoiceChannel.totalSeconds)}`
                            : noData,
                        inline: true,
                    },
                    {
                        name: I18nService.translate(
                            'common:ACTIVITY_PEAK_HOUR',
                            { lng: lang }
                        ),
                        value: peakHour
                            ? I18nService.translate(
                                  'common:ACTIVITY_HOUR_VALUE',
                                  {
                                      lng: lang,
                                      hour: String(peakHour.hour).padStart(
                                          2,
                                          '0'
                                      ),
                                      count: peakHour.messageCount,
                                  }
                              )
                            : noData,
                        inline: true,
                    },
                    {
                        name: I18nService.translate(
                            'common:ACTIVITY_QUIET_HOUR',
                            { lng: lang }
                        ),
                        value: quietHour
                            ? I18nService.translate(
                                  'common:ACTIVITY_HOUR_VALUE',
                                  {
                                      lng: lang,
                                      hour: String(quietHour.hour).padStart(
                                          2,
                                          '0'
                                      ),
                                      count: quietHour.messageCount,
                                  }
                              )
                            : noData,
                        inline: true,
                    }
                );

            await interaction.reply({ embeds: [embed] });
        }
    ),
};

export default command;
