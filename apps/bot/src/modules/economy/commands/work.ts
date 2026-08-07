import { createCommandHandler } from '@/utils/index.js';
import {
    ChatInputCommandInteraction,
    GuildMember,
    MessageFlags,
    SlashCommandBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ComponentType,
} from 'discord.js';
import type { Command } from '@/types/Command.js';
import { I18nService } from '@/services/I18nService.js';
import { WorkService } from '@/services/WorkService.js';
import { AVAILABLE_JOBS } from '../constants.js';
import { EmbedUtils } from '@/utils/EmbedUtils.js';
import { Emojis } from '@/utils/Emojis.js';
import { JobError, CooldownError } from '@/utils/errors.js';
import { QuestService } from '@/services/QuestService.js';
import { LevelRoleService } from '@/services/LevelRoleService.js';
import { formatDuration } from '@/utils/time.js';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('work')
        .setDescription('Work system commands')
        .setDescriptionLocalizations({ fr: 'Commandes du système de travail' })
        .addSubcommand((subcommand) =>
            subcommand
                .setName('list')
                .setDescription('List available jobs')
                .setDescriptionLocalizations({
                    fr: 'Lister les métiers disponibles',
                })
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('join')
                .setDescription('Join a job')
                .setDescriptionLocalizations({ fr: 'Rejoindre un métier' })
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('leave')
                .setDescription('Leave your current job')
                .setDescriptionLocalizations({
                    fr: 'Quitter votre métier actuel',
                })
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('stats')
                .setDescription('View your work statistics')
                .setDescriptionLocalizations({
                    fr: 'Voir vos statistiques de travail',
                })
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('shift')
                .setDescription('Work a shift to earn money')
                .setDescriptionLocalizations({
                    fr: "Faire un service pour gagner de l'argent",
                })
        ),
    execute: createCommandHandler(
        async (interaction: ChatInputCommandInteraction, lang: string) => {
            const subcommand = interaction.options.getSubcommand();
            const guildId = interaction.guildId ?? 'dm';
            try {
                if (subcommand === 'list') {
                    const title = I18nService.translate(
                        'economy:WORK_LIST_TITLE',
                        {
                            lng: lang,
                        }
                    );
                    const embed = EmbedUtils.base({
                        title,
                        color: '#3498DB',
                        user: interaction.user,
                    });
                    let desc = '';
                    for (const job of AVAILABLE_JOBS) {
                        const base = job.ranks[0]!;
                        const top = job.ranks[job.ranks.length - 1]!;
                        desc += `**${base.title}** (ID: \`${job.id}\`)\n`;
                        desc += `└ Exp required: ${job.minExperience} | Salary: ${base.salaryMin}-${base.salaryMax} ${Emojis.Coins} → up to ${top.salaryMin}-${top.salaryMax} ${Emojis.Coins} across ${job.ranks.length} ranks\n\n`;
                    }
                    embed.setDescription(desc);
                    await interaction.reply({ embeds: [embed] });
                } else if (subcommand === 'join') {
                    const embed = EmbedUtils.base({
                        title: 'Job Application',
                        color: '#3498DB',
                        user: interaction.user,
                    }).setDescription(
                        lang === 'fr'
                            ? 'Veuillez sélectionner le métier que vous souhaitez rejoindre ci-dessous.'
                            : 'Please select the job you wish to join below.'
                    );
                    const select = new StringSelectMenuBuilder()
                        .setCustomId('work_join_select')
                        .setPlaceholder(
                            lang === 'fr'
                                ? 'Choisissez un métier...'
                                : 'Choose a job...'
                        )
                        .addOptions(
                            AVAILABLE_JOBS.map((j) => {
                                const base = j.ranks[0]!;
                                return {
                                    label: base.title,
                                    description: `Salary: ${base.salaryMin}-${base.salaryMax} | Req Exp: ${j.minExperience}`,
                                    value: j.id,
                                };
                            })
                        );
                    const row =
                        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                            select
                        );
                    const response = await interaction.reply({
                        embeds: [embed],
                        components: [row],
                    });
                    try {
                        const confirmation =
                            await response.awaitMessageComponent({
                                filter: (i) =>
                                    i.user.id === interaction.user.id,
                                time: 60000,
                                componentType: ComponentType.StringSelect,
                            });
                        const jobId = confirmation.values[0]!;
                        try {
                            const job = await WorkService.joinJob(
                                interaction.user.id,
                                guildId,
                                jobId
                            );
                            const msg = I18nService.translate(
                                'economy:WORK_JOIN_SUCCESS',
                                { lng: lang, job: job!.ranks[0]!.title }
                            );
                            const successEmbed = EmbedUtils.success(
                                msg,
                                'Job Joined',
                                interaction.user
                            );
                            await confirmation.update({
                                embeds: [successEmbed],
                                components: [],
                            });
                        } catch (err: unknown) {
                            let errorMsg = I18nService.translate(
                                'common:ERROR_GENERIC',
                                { lng: lang }
                            );
                            if (err instanceof JobError) {
                                if (err.code === 'WORK_ERR_ALREADY_HAVE')
                                    errorMsg = I18nService.translate(
                                        'economy:WORK_ERR_ALREADY',
                                        { lng: lang }
                                    );
                                else if (
                                    err.code === 'WORK_ERR_INSUFFICIENT_EXP'
                                )
                                    errorMsg = I18nService.translate(
                                        'economy:WORK_ERR_EXP',
                                        { lng: lang, ...err.meta }
                                    );
                                else if (err.code === 'WORK_ERR_NOT_FOUND')
                                    errorMsg = I18nService.translate(
                                        'economy:WORK_ERR_NOT_FOUND',
                                        { lng: lang }
                                    );
                            }
                            const errEmbed = EmbedUtils.error(
                                errorMsg,
                                'Error',
                                interaction.user
                            );
                            await confirmation.update({
                                embeds: [errEmbed],
                                components: [],
                            });
                        }
                    } catch (e) {
                        const timeoutEmbed = EmbedUtils.warn(
                            lang === 'fr'
                                ? 'Temps écoulé pour choisir un métier.'
                                : 'You took too long to select a job.',
                            'Timeout',
                            interaction.user
                        );
                        await interaction.editReply({
                            embeds: [timeoutEmbed],
                            components: [],
                        });
                    }
                } else if (subcommand === 'leave') {
                    await WorkService.leaveJob(interaction.user.id, guildId);
                    const msg = I18nService.translate(
                        'economy:WORK_LEAVE_SUCCESS',
                        {
                            lng: lang,
                        }
                    );
                    const embed = EmbedUtils.success(
                        msg,
                        'Job Left',
                        interaction.user
                    );
                    await interaction.reply({ embeds: [embed] });
                } else if (subcommand === 'stats') {
                    const stats = await WorkService.getStats(
                        interaction.user.id,
                        guildId
                    );
                    const title = I18nService.translate(
                        'economy:WORK_STATS_TITLE',
                        {
                            lng: lang,
                        }
                    );
                    const embed = EmbedUtils.base({
                        title,
                        color: '#9B59B6',
                        user: interaction.user,
                    }).addFields(
                        {
                            name: 'Current Job',
                            value: stats.currentJob || 'None',
                            inline: true,
                        },
                        {
                            name: 'Career Shifts',
                            value: `${stats.shiftsDone}`,
                            inline: true,
                        },
                        {
                            name: 'Experience',
                            value: `${stats.experience}`,
                            inline: true,
                        },
                        {
                            name: '🔥 Streak',
                            value: `${stats.streak} day(s)`,
                            inline: true,
                        }
                    );
                    if (stats.currentJob) {
                        embed.addFields({
                            name: 'Rank Progress',
                            value: stats.nextRankTitle
                                ? `${stats.shiftsUntilNextRank} shift(s) until **${stats.nextRankTitle}**`
                                : '🏆 Max rank reached!',
                            inline: false,
                        });
                    }
                    await interaction.reply({ embeds: [embed] });
                } else if (subcommand === 'shift') {
                    const result = await WorkService.workShift(
                        interaction.user.id,
                        guildId
                    );
                    let msg = I18nService.translate(
                        'economy:WORK_SHIFT_SUCCESS',
                        {
                            lng: lang,
                            job: result.jobTitle,
                            salary: result.salary,
                            exp: result.expGain,
                        }
                    );
                    if (result.streak > 1) {
                        msg +=
                            '\n' +
                            I18nService.translate('economy:WORK_STREAK_LABEL', {
                                lng: lang,
                                streak: result.streak,
                            });
                    }
                    if (result.bonusMoneyActive) {
                        msg +=
                            '\n' +
                            I18nService.translate(
                                'economy:WORK_BONUS_MONEY_ACTIVE',
                                { lng: lang, coinsIcon: Emojis.Coins }
                            );
                    }
                    if (result.bonusXpActive) {
                        msg +=
                            '\n' +
                            I18nService.translate(
                                'economy:WORK_BONUS_XP_ACTIVE',
                                { lng: lang }
                            );
                    }
                    const embed = EmbedUtils.success(
                        msg,
                        'Work Shift Complete',
                        interaction.user
                    );
                    await interaction.reply({ embeds: [embed] });

                    if (result.promoted) {
                        const promoMsg = I18nService.translate(
                            'economy:WORK_PROMOTED',
                            { lng: lang, rank: result.newRankTitle }
                        );
                        await interaction
                            .followUp({
                                embeds: [
                                    EmbedUtils.success(
                                        promoMsg,
                                        'Promotion!',
                                        interaction.user
                                    ),
                                ],
                            })
                            .catch(() => {});
                    }

                    await QuestService.incrementProgress(
                        interaction.user.id,
                        guildId,
                        'work'
                    ).catch(() => {});

                    if (interaction.guild && interaction.member) {
                        const member = interaction.member as GuildMember;
                        const granted =
                            await LevelRoleService.checkAndAssignRole(
                                member,
                                result.newLevel
                            ).catch(() => false);
                        if (granted) {
                            const roleMsg = I18nService.translate(
                                'economy:LEVEL_ROLE_GRANTED',
                                { lng: lang, level: result.newLevel }
                            );
                            await interaction
                                .followUp({
                                    embeds: [
                                        EmbedUtils.success(
                                            roleMsg,
                                            'Level Up!',
                                            interaction.user
                                        ),
                                    ],
                                })
                                .catch(() => {});
                        }
                    }
                }
            } catch (error: unknown) {
                if (error instanceof JobError) {
                    const keyMap: Record<string, string> = {
                        WORK_ERR_NOT_FOUND: 'economy:WORK_ERR_NOT_FOUND',
                        WORK_ERR_ALREADY_HAVE: 'economy:WORK_ERR_ALREADY',
                        WORK_ERR_INSUFFICIENT_EXP: 'economy:WORK_ERR_EXP',
                        WORK_ERR_NO_JOB: 'economy:WORK_ERR_NO_JOB',
                        WORK_ERR_REMOVED: 'economy:WORK_ERR_REMOVED',
                    };
                    const msg = I18nService.translate(
                        keyMap[error.code] ?? 'common:ERROR_GENERIC',
                        { lng: lang, ...error.meta }
                    );
                    const embed = EmbedUtils.error(
                        msg,
                        'Error',
                        interaction.user
                    );
                    await interaction.reply({
                        embeds: [embed],
                        flags: MessageFlags.Ephemeral,
                    });
                } else if (error instanceof CooldownError) {
                    const msg = I18nService.translate(
                        'economy:WORK_ERR_COOLDOWN',
                        {
                            lng: lang,
                            duration: formatDuration(error.remaining),
                        }
                    );
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
                    const embed = EmbedUtils.error(
                        msg,
                        'Error',
                        interaction.user
                    );
                    await interaction.reply({
                        embeds: [embed],
                        flags: MessageFlags.Ephemeral,
                    });
                }
            }
        }
    ),
};

export default command;
