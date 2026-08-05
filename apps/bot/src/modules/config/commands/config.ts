import { createCommandHandler } from '@/utils/index.js';
import {
    ChatInputCommandInteraction,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
    ChannelType,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ComponentType,
} from 'discord.js';
import type { Command } from '@/types/Command.js';
import { I18nService } from '@/services/I18nService.js';
import { GuildConfigService } from '@/services/GuildConfigService.js';
import { EmbedUtils } from '@/utils/EmbedUtils.js';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription('Manage server configuration')
        .setDescriptionLocalizations({
            fr: 'Gérer la configuration du serveur',
        })
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand((subcommand) =>
            subcommand
                .setName('view')
                .setDescription('View current server configuration')
                .setDescriptionLocalizations({
                    fr: 'Voir la configuration actuelle du serveur',
                })
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('language')
                .setDescription('Change the server language')
                .setDescriptionLocalizations({
                    fr: 'Changer la langue du serveur',
                })
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('modlog')
                .setDescription('Set the moderation log channel')
                .setDescriptionLocalizations({
                    fr: 'Définir le salon des logs de modération',
                })
                .addChannelOption(
                    (option) =>
                        option
                            .setName('channel')
                            .setDescription(
                                'The channel to send moderation logs to'
                            )
                            .setDescriptionLocalizations({
                                fr: 'Le salon où envoyer les logs de modération',
                            })
                            .addChannelTypes(ChannelType.GuildText)
                            .setRequired(false) // leave empty to disable
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('maxwarns')
                .setDescription('Set the max warnings before auto-ban')
                .setDescriptionLocalizations({
                    fr: "Définir le maximum d'avertissements avant un auto-ban",
                })
                .addIntegerOption((option) =>
                    option
                        .setName('amount')
                        .setDescription('Number of warnings (default 3)')
                        .setDescriptionLocalizations({
                            fr: "Nombre d'avertissements (défaut 3)",
                        })
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(20)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('modlog_warning')
                .setDescription(
                    'Toggle the reminder to set up a modlog channel'
                )
                .setDescriptionLocalizations({
                    fr: 'Activer ou désactiver le rappel pour configurer un salon de logs',
                })
                .addBooleanOption((option) =>
                    option
                        .setName('enabled')
                        .setDescription(
                            'True to enable the warning, False to disable'
                        )
                        .setDescriptionLocalizations({
                            fr: "Vrai pour activer l'alerte, Faux pour la désactiver",
                        })
                        .setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('automod')
                .setDescription(
                    'Toggle automatic moderation (spam/link detection). Disabled by default.'
                )
                .setDescriptionLocalizations({
                    fr: 'Activer/désactiver la modération automatique (spam/liens). Désactivée par défaut.',
                })
                .addBooleanOption((option) =>
                    option
                        .setName('enabled')
                        .setDescription('True to enable, False to disable')
                        .setDescriptionLocalizations({
                            fr: 'Vrai pour activer, Faux pour désactiver',
                        })
                        .setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('levelrole')
                .setDescription(
                    'Set the role automatically granted at a given level'
                )
                .setDescriptionLocalizations({
                    fr: 'Définir le rôle attribué automatiquement à partir d’un niveau donné',
                })
                .addRoleOption((option) =>
                    option
                        .setName('role')
                        .setDescription(
                            'The role to grant (leave empty to disable)'
                        )
                        .setDescriptionLocalizations({
                            fr: 'Le rôle à attribuer (laisser vide pour désactiver)',
                        })
                        .setRequired(false)
                )
                .addIntegerOption((option) =>
                    option
                        .setName('threshold')
                        .setDescription('The level required to get the role')
                        .setDescriptionLocalizations({
                            fr: 'Le niveau requis pour obtenir le rôle',
                        })
                        .setRequired(false)
                        .setMinValue(1)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('leaderboardchannel')
                .setDescription(
                    'Set the channel for the weekly top-3 leaderboard reward announcement'
                )
                .setDescriptionLocalizations({
                    fr: "Définir le salon d'annonce de la récompense hebdomadaire du classement (top 3)",
                })
                .addChannelOption((option) =>
                    option
                        .setName('channel')
                        .setDescription(
                            'The channel to announce in (leave empty to disable)'
                        )
                        .setDescriptionLocalizations({
                            fr: "Le salon d'annonce (laisser vide pour désactiver)",
                        })
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false)
                )
        )
        .addSubcommandGroup((group) =>
            group
                .setName('events')
                .setDescription('Manage random event channels')
                .setDescriptionLocalizations({
                    fr: "Gérer les salons d'événements aléatoires",
                })
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('add')
                        .setDescription('Add a channel for random events')
                        .setDescriptionLocalizations({
                            fr: 'Ajouter un salon pour les événements aléatoires',
                        })
                        .addChannelOption((option) =>
                            option
                                .setName('channel')
                                .setDescription('The channel to add')
                                .setDescriptionLocalizations({
                                    fr: 'Le salon à ajouter',
                                })
                                .addChannelTypes(ChannelType.GuildText)
                                .setRequired(true)
                        )
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('remove')
                        .setDescription('Remove a channel from random events')
                        .setDescriptionLocalizations({
                            fr: 'Retirer un salon des événements aléatoires',
                        })
                        .addChannelOption((option) =>
                            option
                                .setName('channel')
                                .setDescription('The channel to remove')
                                .setDescriptionLocalizations({
                                    fr: 'Le salon à retirer',
                                })
                                .addChannelTypes(ChannelType.GuildText)
                                .setRequired(true)
                        )
                )
        ),
    execute: createCommandHandler(
        async (interaction: ChatInputCommandInteraction, lang: string) => {
            if (!interaction.guildId) {
                const embed = EmbedUtils.error(
                    I18nService.translate('common:ERR_ONLY_SERVER', {
                        lng: 'en',
                    }),
                    I18nService.translate('common:EMBED_TITLE_ERROR', {
                        lng: 'en',
                    }),
                    interaction.user
                );
                await interaction.reply({
                    embeds: [embed],
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }
            // Explicitly check for permissions just in case
            if (
                !interaction.memberPermissions?.has(
                    PermissionFlagsBits.ManageGuild
                )
            ) {
                const errorMsg = I18nService.translate(
                    'common:CONFIG_NO_PERM',
                    {
                        lng: lang,
                    }
                );
                const embed = EmbedUtils.error(
                    errorMsg,
                    I18nService.translate('common:EMBED_TITLE_ACCESS_DENIED', {
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

            const subcommandGroup =
                interaction.options.getSubcommandGroup(false);
            const subcommand = interaction.options.getSubcommand();

            if (subcommandGroup === 'events') {
                const channel = interaction.options.getChannel('channel', true);
                if (subcommand === 'add') {
                    await GuildConfigService.addEventChannel(
                        interaction.guildId,
                        channel.id
                    );
                    const msg = I18nService.translate(
                        'common:CONFIG_EVENT_ADD_SUCCESS',
                        {
                            lng: lang,
                            channel: channel.id,
                        }
                    );
                    const embed = EmbedUtils.success(
                        msg,
                        I18nService.translate('common:EMBED_TITLE_CONFIG', {
                            lng: lang,
                        }),
                        interaction.user
                    );
                    await interaction.reply({ embeds: [embed] });
                } else if (subcommand === 'remove') {
                    await GuildConfigService.removeEventChannel(
                        interaction.guildId,
                        channel.id
                    );
                    const msg = I18nService.translate(
                        'common:CONFIG_EVENT_REMOVE_SUCCESS',
                        {
                            lng: lang,
                            channel: channel.id,
                        }
                    );
                    const embed = EmbedUtils.success(
                        msg,
                        I18nService.translate('common:EMBED_TITLE_CONFIG', {
                            lng: lang,
                        }),
                        interaction.user
                    );
                    await interaction.reply({ embeds: [embed] });
                }
                return;
            }

            if (subcommand === 'view') {
                const config = await GuildConfigService.getGuildSettings(
                    interaction.guildId
                );
                const title = I18nService.translate(
                    'common:CONFIG_VIEW_TITLE',
                    {
                        lng: lang,
                    }
                );
                const desc = I18nService.translate('common:CONFIG_VIEW_DESC', {
                    lng: lang,
                });
                const langLabel = I18nService.translate(
                    'common:CONFIG_VIEW_LANG',
                    {
                        lng: lang,
                    }
                );
                const embed = EmbedUtils.base({
                    title,
                    description: desc,
                    user: interaction.user,
                }).addFields(
                    {
                        name: `${langLabel}`,
                        value: lang === 'fr' ? 'Français (fr)' : 'English (en)',
                        inline: true,
                    },
                    {
                        name: `Mod Log`,
                        value: config.modLogChannel
                            ? `<#${config.modLogChannel}>`
                            : 'Disabled',
                        inline: true,
                    },
                    {
                        name: `Max Warns`,
                        value: `${config.maxWarns} warns (Auto-Ban)`,
                        inline: true,
                    },
                    {
                        name: `Auto-Mod`,
                        value: config.autoModEnabled ? 'Enabled' : 'Disabled',
                        inline: true,
                    },
                    {
                        name: `Level Role`,
                        value:
                            config.levelRoleId && config.levelRoleThreshold
                                ? `<@&${config.levelRoleId}> at level ${config.levelRoleThreshold}`
                                : 'Disabled',
                        inline: true,
                    },
                    {
                        name: `Leaderboard Reward Channel`,
                        value: config.leaderboardChannel
                            ? `<#${config.leaderboardChannel}>`
                            : 'Disabled',
                        inline: true,
                    }
                );
                await interaction.reply({
                    embeds: [embed],
                    flags: MessageFlags.Ephemeral,
                });
            } else if (subcommand === 'language') {
                const embed = EmbedUtils.base({
                    title: 'Language / Langue',
                    color: '#3498DB',
                    user: interaction.user,
                }).setDescription(
                    lang === 'fr'
                        ? 'Veuillez sélectionner la langue du serveur ci-dessous.'
                        : 'Please select the server language below.'
                );
                const select = new StringSelectMenuBuilder()
                    .setCustomId('config_lang_select')
                    .setPlaceholder(
                        lang === 'fr'
                            ? 'Choisissez une langue...'
                            : 'Choose a language...'
                    )
                    .addOptions([
                        { label: 'English', value: 'en' },
                        { label: 'Français', value: 'fr' },
                    ]);
                const row =
                    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                        select
                    );
                const response = await interaction.reply({
                    embeds: [embed],
                    components: [row],
                    flags: MessageFlags.Ephemeral,
                });
                try {
                    const confirmation = await response.awaitMessageComponent({
                        filter: (i) => i.user.id === interaction.user.id,
                        time: 60000,
                        componentType: ComponentType.StringSelect,
                    });
                    const newLang = confirmation.values[0] as 'en' | 'fr';
                    await GuildConfigService.setLanguage(
                        interaction.guildId,
                        newLang
                    );
                    const successMsg = I18nService.translate(
                        'common:CONFIG_LANG_SUCCESS',
                        {
                            lng: newLang,
                            lang: newLang === 'fr' ? 'Français' : 'English',
                        }
                    );
                    const successEmbed = EmbedUtils.success(
                        successMsg,
                        I18nService.translate(
                            'common:EMBED_TITLE_CONFIG_UPDATED',
                            { lng: lang }
                        ),
                        interaction.user
                    );
                    await confirmation.update({
                        embeds: [successEmbed],
                        components: [],
                    });
                } catch (e) {
                    const timeoutEmbed = EmbedUtils.warn(
                        lang === 'fr' ? 'Temps écoulé.' : 'Timeout.',
                        I18nService.translate('common:EMBED_TITLE_TIMEOUT', {
                            lng: lang,
                        }),
                        interaction.user
                    );
                    await interaction.editReply({
                        embeds: [timeoutEmbed],
                        components: [],
                    });
                }
            } else if (subcommand === 'modlog') {
                const channel = interaction.options.getChannel('channel');
                await GuildConfigService.setModLogChannel(
                    interaction.guildId,
                    channel ? channel.id : null
                );
                const embed = EmbedUtils.success(
                    I18nService.translate('common:CONFIG_MODLOG_SUCCESS', {
                        lng: lang,
                        state: channel ? `<#${channel.id}>` : 'Disabled',
                    }),
                    I18nService.translate('common:EMBED_TITLE_CONFIG_UPDATED', {
                        lng: lang,
                    }),
                    interaction.user
                );
                await interaction.reply({
                    embeds: [embed],
                    flags: MessageFlags.Ephemeral,
                });
            } else if (subcommand === 'maxwarns') {
                const amount = interaction.options.getInteger('amount', true);
                await GuildConfigService.setMaxWarns(
                    interaction.guildId,
                    amount
                );
                const embed = EmbedUtils.success(
                    I18nService.translate('common:CONFIG_MAXWARNS_SUCCESS', {
                        lng: lang,
                        amount,
                    }),
                    I18nService.translate('common:EMBED_TITLE_CONFIG_UPDATED', {
                        lng: lang,
                    }),
                    interaction.user
                );
                await interaction.reply({
                    embeds: [embed],
                    flags: MessageFlags.Ephemeral,
                });
            } else if (subcommand === 'modlog_warning') {
                const enabled = interaction.options.getBoolean('enabled', true);
                await GuildConfigService.setModLogWarning(
                    interaction.guildId,
                    enabled
                );
                const embed = EmbedUtils.success(
                    I18nService.translate(
                        'common:CONFIG_MODLOG_WARNING_SUCCESS',
                        {
                            lng: lang,
                            state: enabled ? 'Enabled' : 'Disabled',
                        }
                    ),
                    I18nService.translate('common:EMBED_TITLE_CONFIG_UPDATED', {
                        lng: lang,
                    }),
                    interaction.user
                );
                await interaction.reply({
                    embeds: [embed],
                    flags: MessageFlags.Ephemeral,
                });
            } else if (subcommand === 'automod') {
                const enabled = interaction.options.getBoolean('enabled', true);
                await GuildConfigService.setAutoModEnabled(
                    interaction.guildId,
                    enabled
                );
                const embed = EmbedUtils.success(
                    I18nService.translate('common:CONFIG_AUTOMOD_SUCCESS', {
                        lng: lang,
                        state: enabled ? 'Enabled' : 'Disabled',
                    }),
                    I18nService.translate('common:EMBED_TITLE_CONFIG_UPDATED', {
                        lng: lang,
                    }),
                    interaction.user
                );
                await interaction.reply({
                    embeds: [embed],
                    flags: MessageFlags.Ephemeral,
                });
            } else if (subcommand === 'levelrole') {
                const role = interaction.options.getRole('role');
                const threshold = interaction.options.getInteger('threshold');
                await GuildConfigService.setLevelRole(
                    interaction.guildId,
                    role ? role.id : null,
                    role ? (threshold ?? 1) : null
                );
                const embed = EmbedUtils.success(
                    I18nService.translate('common:CONFIG_LEVELROLE_SUCCESS', {
                        lng: lang,
                        state: role
                            ? `<@&${role.id}> @ level ${threshold ?? 1}`
                            : 'Disabled',
                    }),
                    I18nService.translate('common:EMBED_TITLE_CONFIG_UPDATED', {
                        lng: lang,
                    }),
                    interaction.user
                );
                await interaction.reply({
                    embeds: [embed],
                    flags: MessageFlags.Ephemeral,
                });
            } else if (subcommand === 'leaderboardchannel') {
                const channel = interaction.options.getChannel('channel');
                await GuildConfigService.setLeaderboardChannel(
                    interaction.guildId,
                    channel ? channel.id : null
                );
                const embed = EmbedUtils.success(
                    I18nService.translate(
                        'common:CONFIG_LEADERBOARD_CHANNEL_SUCCESS',
                        {
                            lng: lang,
                            state: channel ? `<#${channel.id}>` : 'Disabled',
                        }
                    ),
                    I18nService.translate('common:EMBED_TITLE_CONFIG_UPDATED', {
                        lng: lang,
                    }),
                    interaction.user
                );
                await interaction.reply({
                    embeds: [embed],
                    flags: MessageFlags.Ephemeral,
                });
            }
        }
    ),
};

export default command;
