import { createCommandHandler } from '@/utils/index.js';
import {
    MessageFlags,
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    PermissionFlagsBits,
} from 'discord.js';
import type { Command } from '@/types/Command.js';
import { I18nService } from '@/services/I18nService.js';
import { GuildConfigService } from '@/services/GuildConfigService.js';
import { ModerationService } from '@/services/ModerationService.js';
import { EmbedUtils } from '@/utils/EmbedUtils.js';
import { performModAction } from '@/utils/ModAction.js';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('mod')
        .setDescription('Moderation commands')
        .setDescriptionLocalizations({ fr: 'Commandes de modération' })
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addSubcommand((sub) =>
            sub
                .setName('warn')
                .setDescription('Warn a user')
                .setDescriptionLocalizations({ fr: 'Avertir un utilisateur' })
                .addUserOption((opt) =>
                    opt
                        .setName('user')
                        .setDescription('User to warn')
                        .setDescriptionLocalizations({
                            fr: 'Utilisateur à avertir',
                        })
                        .setRequired(true)
                )
                .addStringOption((opt) =>
                    opt
                        .setName('reason')
                        .setDescription('Reason for the warning')
                        .setDescriptionLocalizations({
                            fr: "Raison de l'avertissement",
                        })
                        .setRequired(false)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName('warnings')
                .setDescription("View a user's warnings")
                .setDescriptionLocalizations({
                    fr: "Voir les avertissements d'un utilisateur",
                })
                .addUserOption((opt) =>
                    opt
                        .setName('user')
                        .setDescription('User to check')
                        .setDescriptionLocalizations({
                            fr: 'Utilisateur à vérifier',
                        })
                        .setRequired(true)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName('stats')
                .setDescription('View moderation statistics for a user')
                .setDescriptionLocalizations({
                    fr: "Voir les statistiques de modération d'un utilisateur",
                })
                .addUserOption((opt) =>
                    opt
                        .setName('user')
                        .setDescription('User to check')
                        .setDescriptionLocalizations({
                            fr: 'Utilisateur à vérifier',
                        })
                        .setRequired(true)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName('clearwarns')
                .setDescription('Clear all warnings for a user')
                .setDescriptionLocalizations({
                    fr: "Effacer tous les avertissements d'un utilisateur",
                })
                .addUserOption((opt) =>
                    opt
                        .setName('user')
                        .setDescription('User to clear')
                        .setDescriptionLocalizations({
                            fr: 'Utilisateur à effacer',
                        })
                        .setRequired(true)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName('mute')
                .setDescription('Timeout a user')
                .setDescriptionLocalizations({
                    fr: 'Rendre un utilisateur muet',
                })
                .addUserOption((opt) =>
                    opt
                        .setName('user')
                        .setDescription('User to mute')
                        .setDescriptionLocalizations({
                            fr: 'Utilisateur à rendre muet',
                        })
                        .setRequired(true)
                )
                .addIntegerOption((opt) =>
                    opt
                        .setName('duration')
                        .setDescription('Duration in minutes')
                        .setDescriptionLocalizations({ fr: 'Durée en minutes' })
                        .setMinValue(1)
                        .setMaxValue(40320)
                        .setRequired(true)
                )
                .addStringOption((opt) =>
                    opt
                        .setName('reason')
                        .setDescription('Reason for the mute')
                        .setDescriptionLocalizations({
                            fr: 'Raison de la mise sous silence',
                        })
                        .setRequired(false)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName('unmute')
                .setDescription('Remove timeout from a user')
                .setDescriptionLocalizations({
                    fr: "Retirer le mode muet d'un utilisateur",
                })
                .addUserOption((opt) =>
                    opt
                        .setName('user')
                        .setDescription('User to unmute')
                        .setDescriptionLocalizations({
                            fr: 'Utilisateur à ne plus rendre muet',
                        })
                        .setRequired(true)
                )
                .addStringOption((opt) =>
                    opt
                        .setName('reason')
                        .setDescription('Reason')
                        .setDescriptionLocalizations({ fr: 'Raison' })
                        .setRequired(false)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName('kick')
                .setDescription('Kick a user')
                .setDescriptionLocalizations({ fr: 'Expulser un utilisateur' })
                .addUserOption((opt) =>
                    opt
                        .setName('user')
                        .setDescription('User to kick')
                        .setDescriptionLocalizations({
                            fr: 'Utilisateur à expulser',
                        })
                        .setRequired(true)
                )
                .addStringOption((opt) =>
                    opt
                        .setName('reason')
                        .setDescription('Reason for the kick')
                        .setDescriptionLocalizations({
                            fr: "Raison de l'expulsion",
                        })
                        .setRequired(false)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName('ban')
                .setDescription('Ban a user')
                .setDescriptionLocalizations({ fr: 'Bannir un utilisateur' })
                .addUserOption((opt) =>
                    opt
                        .setName('user')
                        .setDescription('User to ban')
                        .setDescriptionLocalizations({
                            fr: 'Utilisateur à bannir',
                        })
                        .setRequired(true)
                )
                .addStringOption((opt) =>
                    opt
                        .setName('reason')
                        .setDescription('Reason for the ban')
                        .setDescriptionLocalizations({
                            fr: 'Raison du bannissement',
                        })
                        .setRequired(false)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName('softban')
                .setDescription(
                    'Ban and immediately unban a user (deletes recent messages)'
                )
                .setDescriptionLocalizations({
                    fr: 'Bannir et débannir immédiatement pour effacer les messages',
                })
                .addUserOption((opt) =>
                    opt
                        .setName('user')
                        .setDescription('User to softban')
                        .setDescriptionLocalizations({
                            fr: 'Utilisateur à softban',
                        })
                        .setRequired(true)
                )
                .addStringOption((opt) =>
                    opt
                        .setName('reason')
                        .setDescription('Reason')
                        .setDescriptionLocalizations({ fr: 'Raison' })
                        .setRequired(false)
                )
        ),
    execute: createCommandHandler(
        async (interaction: ChatInputCommandInteraction, lang: string) => {
            if (!interaction.guild) return;
            const config = await GuildConfigService.getGuildSettings(
                interaction.guild.id
            );
            let warningMsg = '';
            if (config.modLogWarning && !config.modLogChannel) {
                warningMsg =
                    '\n\n' +
                    I18nService.translate('mod:MOD_LOG_WARNING', { lng: lang });
            }
            const subcommand = interaction.options.getSubcommand();
            const targetUser = interaction.options.getUser('user', true);
            const targetMember = await interaction.guild.members
                .fetch(targetUser.id)
                .catch(() => null);
            const reason =
                interaction.options.getString('reason') || 'No reason provided';
            if (
                targetUser.id === interaction.client.user.id ||
                targetUser.id === interaction.guild.ownerId ||
                targetUser.id === interaction.user.id
            ) {
                const embed = EmbedUtils.error(
                    I18nService.translate('mod:MOD_ERR_INVALID_TARGET', {
                        lng: lang,
                    }),
                    'Error',
                    interaction.user
                );
                await interaction.reply({
                    embeds: [embed],
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }
            if (subcommand === 'warn') {
                if (!targetMember) {
                    const embed = EmbedUtils.error(
                        I18nService.translate('mod:MOD_ERR_NOT_IN_GUILD', {
                            lng: lang,
                        }),
                        'Error',
                        interaction.user
                    );
                    await interaction.reply({
                        embeds: [embed],
                        flags: MessageFlags.Ephemeral,
                    });
                    return;
                }
                const res = await ModerationService.warn(
                    interaction.guild,
                    targetMember,
                    interaction.user,
                    reason
                );
                let replyContent = I18nService.translate(
                    'mod:MOD_WARN_SUCCESS',
                    {
                        lng: lang,
                        user: targetUser.tag,
                        reason,
                        warns: res.warnsCount,
                        max: res.maxWarns,
                    }
                );
                if (res.autobanned) {
                    replyContent +=
                        '\n' +
                        I18nService.translate('mod:MOD_AUTOBAN_TRIGGERED', {
                            lng: lang,
                            user: targetUser.tag,
                        });
                }
                const embed = EmbedUtils.success(
                    replyContent + warningMsg,
                    'Moderation Action',
                    interaction.user
                );
                await interaction.reply({
                    embeds: [embed],
                    flags: MessageFlags.Ephemeral,
                });
            } else if (subcommand === 'warnings') {
                const warns = await ModerationService.getWarnings(
                    interaction.guild.id,
                    targetUser.id
                );
                if (warns.length === 0) {
                    const embed = EmbedUtils.info(
                        I18nService.translate('mod:MOD_WARNINGS_EMPTY', {
                            lng: lang,
                            user: targetUser.tag,
                        }),
                        'No Warnings',
                        interaction.user
                    );
                    await interaction.reply({
                        embeds: [embed],
                        flags: MessageFlags.Ephemeral,
                    });
                    return;
                }
                const embed = EmbedUtils.base({
                    title: I18nService.translate('mod:MOD_WARNINGS_TITLE', {
                        lng: lang,
                        user: targetUser.tag,
                    }),
                    color: '#F1C40F',
                    user: interaction.user,
                });
                let desc = '';
                for (const w of warns) {
                    desc += `**ID:** ${w.id} | **Mod:** <@${w.moderatorId}>\n**Reason:** ${w.reason}\n**Date:** <t:${Math.floor(w.createdAt.getTime() / 1000)}:f>\n\n`;
                }
                embed.setDescription(desc);
                await interaction.reply({
                    embeds: [embed],
                    flags: MessageFlags.Ephemeral,
                });
            } else if (subcommand === 'stats') {
                const [stats, warns, history] = await Promise.all([
                    ModerationService.getModStats(
                        targetUser.id,
                        interaction.guild.id
                    ),
                    ModerationService.getWarnings(
                        interaction.guild.id,
                        targetUser.id
                    ),
                    ModerationService.getModHistory(
                        interaction.guild.id,
                        targetUser.id
                    ),
                ]);
                const recentHistory = history
                    .sort(
                        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
                    )
                    .slice(0, 5);
                let historyText = recentHistory
                    .map(
                        (h) =>
                            `**${h.actionType}** - ${h.reason} (<t:${Math.floor(
                                h.createdAt.getTime() / 1000
                            )}:d>)`
                    )
                    .join('\n');
                if (!historyText) historyText = 'No recent actions';

                const embed = EmbedUtils.base({
                    title: I18nService.translate('mod:MOD_STATS_TITLE', {
                        lng: lang,
                        user: targetUser.tag,
                    }),
                    color: '#3498DB',
                    user: interaction.user,
                })
                    .setThumbnail(targetUser.displayAvatarURL())
                    .addFields(
                        {
                            name: '⚠️ Warnings',
                            value: `${warns.length}`,
                            inline: true,
                        },
                        {
                            name: '🔇 Mutes',
                            value: `${stats.mutes}`,
                            inline: true,
                        },
                        {
                            name: '👢 Kicks',
                            value: `${stats.kicks}`,
                            inline: true,
                        },
                        {
                            name: '🔨 Bans',
                            value: `${stats.bans}`,
                            inline: true,
                        },
                        {
                            name: '📜 Recent History',
                            value: historyText,
                            inline: false,
                        }
                    );
                await interaction.reply({
                    embeds: [embed],
                    flags: MessageFlags.Ephemeral,
                });
            } else if (subcommand === 'clearwarns') {
                const deleted = await ModerationService.clearWarnings(
                    interaction.guild,
                    targetUser,
                    interaction.user,
                    reason
                );
                const embed = EmbedUtils.success(
                    I18nService.translate('mod:MOD_CLEARWARNS_SUCCESS', {
                        lng: lang,
                        user: targetUser.tag,
                        count: deleted,
                    }) + warningMsg,
                    'Warnings Cleared',
                    interaction.user
                );
                await interaction.reply({
                    embeds: [embed],
                    flags: MessageFlags.Ephemeral,
                });
            } else if (subcommand === 'mute') {
                if (!targetMember) return;
                const duration = interaction.options.getInteger(
                    'duration',
                    true
                );
                await performModAction({
                    interaction,
                    lang,
                    targetUser,
                    targetMember,
                    requireMember: true,
                    reason,
                    warningMsg,
                    action: 'MUTE',
                    apiCall: () =>
                        targetMember.timeout(duration * 60 * 1000, reason),
                    logDetails: `Duration: ${duration} minutes`,
                    expiresAt: new Date(Date.now() + duration * 60 * 1000),
                    successKey: 'mod:MOD_MUTE_SUCCESS',
                    successVars: { duration },
                    successTitle: 'User Muted',
                });
            } else if (subcommand === 'unmute') {
                if (!targetMember) return;
                await performModAction({
                    interaction,
                    lang,
                    targetUser,
                    targetMember,
                    requireMember: true,
                    reason,
                    warningMsg,
                    action: 'UNMUTE',
                    apiCall: () => targetMember.timeout(null, reason),
                    successKey: 'mod:MOD_UNMUTE_SUCCESS',
                    successTitle: 'User Unmuted',
                });
            } else if (subcommand === 'kick') {
                if (!targetMember) return;
                await performModAction({
                    interaction,
                    lang,
                    targetUser,
                    targetMember,
                    requireMember: true,
                    reason,
                    warningMsg,
                    action: 'KICK',
                    apiCall: () => targetMember.kick(reason),
                    successKey: 'mod:MOD_KICK_SUCCESS',
                    successTitle: 'User Kicked',
                });
            } else if (subcommand === 'ban') {
                await performModAction({
                    interaction,
                    lang,
                    targetUser,
                    reason,
                    warningMsg,
                    action: 'BAN',
                    apiCall: () =>
                        interaction.guild!.members.ban(targetUser, { reason }),
                    successKey: 'mod:MOD_BAN_SUCCESS',
                    successTitle: 'User Banned',
                });
            } else if (subcommand === 'softban') {
                await performModAction({
                    interaction,
                    lang,
                    targetUser,
                    reason,
                    warningMsg,
                    action: 'SOFTBAN',
                    apiCall: async () => {
                        await interaction.guild!.members.ban(targetUser, {
                            reason,
                            deleteMessageSeconds: 604800,
                        }); // 7 days
                        await interaction.guild!.members.unban(
                            targetUser,
                            'Softban complete'
                        );
                    },
                    successKey: 'mod:MOD_SOFTBAN_SUCCESS',
                    successTitle: 'User Softbanned',
                });
            }
        }
    ),
};

export default command;
