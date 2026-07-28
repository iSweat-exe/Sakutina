import { createCommandHandler } from '../../../utils/index.js';
import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
    ChannelType,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ComponentType,
} from 'discord.js';
import type { Command } from '../../../types/Command.js';
import { I18nService } from '../../../services/I18nService.js';
import { GuildConfigService } from '../../../services/GuildConfigService.js';
import { EmbedUtils } from '../../../utils/EmbedUtils.js';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('config')
        .setNameLocalizations({ fr: 'config' })
        .setDescription('Manage server configuration')
        .setDescriptionLocalizations({
            fr: 'Gérer la configuration du serveur',
        })
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand((subcommand) =>
            subcommand
                .setName('view')
                .setNameLocalizations({ fr: 'voir' })
                .setDescription('View current server configuration')
                .setDescriptionLocalizations({
                    fr: 'Voir la configuration actuelle du serveur',
                })
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('language')
                .setNameLocalizations({ fr: 'langue' })
                .setDescription('Change the server language')
                .setDescriptionLocalizations({
                    fr: 'Changer la langue du serveur',
                })
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('modlog')
                .setNameLocalizations({ fr: 'logs_modo' })
                .setDescription('Set the moderation log channel')
                .setDescriptionLocalizations({
                    fr: 'Définir le salon des logs de modération',
                })
                .addChannelOption(
                    (option) =>
                        option
                            .setName('channel')
                            .setNameLocalizations({ fr: 'salon' })
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
                .setNameLocalizations({ fr: 'max_avertissements' })
                .setDescription('Set the max warnings before auto-ban')
                .setDescriptionLocalizations({
                    fr: "Définir le maximum d'avertissements avant un auto-ban",
                })
                .addIntegerOption((option) =>
                    option
                        .setName('amount')
                        .setNameLocalizations({ fr: 'montant' })
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
                .setNameLocalizations({ fr: 'alerte_logs_modo' })
                .setDescription(
                    'Toggle the reminder to set up a modlog channel'
                )
                .setDescriptionLocalizations({
                    fr: 'Activer ou désactiver le rappel pour configurer un salon de logs',
                })
                .addBooleanOption((option) =>
                    option
                        .setName('enabled')
                        .setNameLocalizations({ fr: 'active' })
                        .setDescription(
                            'True to enable the warning, False to disable'
                        )
                        .setDescriptionLocalizations({
                            fr: "Vrai pour activer l'alerte, Faux pour la désactiver",
                        })
                        .setRequired(true)
                )
        )
        .addSubcommandGroup((group) =>
            group
                .setName('events')
                .setNameLocalizations({ fr: 'evenements' })
                .setDescription('Manage random event channels')
                .setDescriptionLocalizations({ fr: 'Gérer les salons d\'événements aléatoires' })
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('add')
                        .setNameLocalizations({ fr: 'ajouter' })
                        .setDescription('Add a channel for random events')
                        .setDescriptionLocalizations({ fr: 'Ajouter un salon pour les événements aléatoires' })
                        .addChannelOption((option) =>
                            option
                                .setName('channel')
                                .setNameLocalizations({ fr: 'salon' })
                                .setDescription('The channel to add')
                                .setDescriptionLocalizations({ fr: 'Le salon à ajouter' })
                                .addChannelTypes(ChannelType.GuildText)
                                .setRequired(true)
                        )
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('remove')
                        .setNameLocalizations({ fr: 'retirer' })
                        .setDescription('Remove a channel from random events')
                        .setDescriptionLocalizations({ fr: 'Retirer un salon des événements aléatoires' })
                        .addChannelOption((option) =>
                            option
                                .setName('channel')
                                .setNameLocalizations({ fr: 'salon' })
                                .setDescription('The channel to remove')
                                .setDescriptionLocalizations({ fr: 'Le salon à retirer' })
                                .addChannelTypes(ChannelType.GuildText)
                                .setRequired(true)
                        )
                )
        ),
    execute: createCommandHandler(async (interaction: ChatInputCommandInteraction, lang: string) => {
        if (!interaction.guildId) {
            const embed = EmbedUtils.error(
                I18nService.translate('common:ERR_ONLY_SERVER', { lng: 'en' }),
                I18nService.translate('common:EMBED_TITLE_ERROR', { lng: 'en' }),
                interaction.user
            );
            await interaction.reply({
                embeds: [embed],
                flags: MessageFlags.Ephemeral,
            });
            return;
        }
        const currentLang = await GuildConfigService.getGuildLanguage(
            interaction.guildId
        );
        // Explicitly check for permissions just in case
        if (
            !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
        ) {
            const errorMsg = I18nService.translate('common:CONFIG_NO_PERM', {
                lng: currentLang,
            });
            const embed = EmbedUtils.error(
                errorMsg,
                I18nService.translate('common:EMBED_TITLE_ACCESS_DENIED', { lng: currentLang }),
                interaction.user
            );
            await interaction.reply({
                embeds: [embed],
                flags: MessageFlags.Ephemeral,
            });
            return;
        }
        
        const subcommandGroup = interaction.options.getSubcommandGroup(false);
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommandGroup === 'events') {
            const channel = interaction.options.getChannel('channel', true);
            if (subcommand === 'add') {
                await GuildConfigService.addEventChannel(interaction.guildId, channel.id);
                const msg = I18nService.translate('common:CONFIG_EVENT_ADD_SUCCESS', {
                    lng: currentLang,
                    channel: channel.id
                });
                const embed = EmbedUtils.success(msg, I18nService.translate('common:EMBED_TITLE_CONFIG', { lng: currentLang }), interaction.user);
                await interaction.reply({ embeds: [embed] });
            } else if (subcommand === 'remove') {
                await GuildConfigService.removeEventChannel(interaction.guildId, channel.id);
                const msg = I18nService.translate('common:CONFIG_EVENT_REMOVE_SUCCESS', {
                    lng: currentLang,
                    channel: channel.id
                });
                const embed = EmbedUtils.success(msg, I18nService.translate('common:EMBED_TITLE_CONFIG', { lng: currentLang }), interaction.user);
                await interaction.reply({ embeds: [embed] });
            }
            return;
        }

        if (subcommand === 'view') {
            const config = await GuildConfigService.getGuildSettings(
                interaction.guildId
            );
            const title = I18nService.translate('common:CONFIG_VIEW_TITLE', {
                lng: currentLang,
            });
            const desc = I18nService.translate('common:CONFIG_VIEW_DESC', {
                lng: currentLang,
            });
            const langLabel = I18nService.translate('common:CONFIG_VIEW_LANG', {
                lng: currentLang,
            });
            const embed = EmbedUtils.base({
                title,
                description: desc,
                user: interaction.user,
            }).addFields(
                {
                    name: `${langLabel}`,
                    value:
                        currentLang === 'fr' ? 'Français (fr)' : 'English (en)',
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
                currentLang === 'fr'
                    ? 'Veuillez sélectionner la langue du serveur ci-dessous.'
                    : 'Please select the server language below.'
            );
            const select = new StringSelectMenuBuilder()
                .setCustomId('config_lang_select')
                .setPlaceholder(
                    currentLang === 'fr'
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
                    I18nService.translate('common:EMBED_TITLE_CONFIG_UPDATED', { lng: currentLang }),
                    interaction.user
                );
                await confirmation.update({
                    embeds: [successEmbed],
                    components: [],
                });
            } catch (e) {
                const timeoutEmbed = EmbedUtils.warn(
                    currentLang === 'fr' ? 'Temps écoulé.' : 'Timeout.',
                    I18nService.translate('common:EMBED_TITLE_TIMEOUT', { lng: currentLang }),
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
                    lng: currentLang,
                    state: channel ? `<#${channel.id}>` : 'Disabled',
                }),
                I18nService.translate('common:EMBED_TITLE_CONFIG_UPDATED', { lng: currentLang }),
                interaction.user
            );
            await interaction.reply({
                embeds: [embed],
                flags: MessageFlags.Ephemeral,
            });
        } else if (subcommand === 'maxwarns') {
            const amount = interaction.options.getInteger('amount', true);
            await GuildConfigService.setMaxWarns(interaction.guildId, amount);
            const embed = EmbedUtils.success(
                I18nService.translate('common:CONFIG_MAXWARNS_SUCCESS', {
                    lng: currentLang,
                    amount,
                }),
                I18nService.translate('common:EMBED_TITLE_CONFIG_UPDATED', { lng: currentLang }),
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
                I18nService.translate('common:CONFIG_MODLOG_WARNING_SUCCESS', {
                    lng: currentLang,
                    state: enabled ? 'Enabled' : 'Disabled',
                }),
                I18nService.translate('common:EMBED_TITLE_CONFIG_UPDATED', { lng: currentLang }),
                interaction.user
            );
            await interaction.reply({
                embeds: [embed],
                flags: MessageFlags.Ephemeral,
            });
        }
    }),
};

export default command;
