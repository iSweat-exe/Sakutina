import { createCommandHandler } from '../../../utils/index.js';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChatInputCommandInteraction,
    ComponentType,
    type InteractionResponse,
    type Message,
    MessageFlags,
    SlashCommandBuilder,
} from 'discord.js';
import type { Command } from '../../../types/Command.js';
import { I18nService } from '../../../services/I18nService.js';
import { MarriageService } from '../../../services/MarriageService.js';
import { EmbedUtils } from '../../../utils/EmbedUtils.js';
import { MarriageError } from '../../../utils/errors.js';
import { getGif } from '../../../utils/gif.js';
import { logger } from '../../../utils/logger.js';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('marry')
        .setDescription('Marriage system — works in DMs too')
        .setDescriptionLocalizations({
            fr: 'Système de mariage — fonctionne aussi en MP',
        })
        .addSubcommand((sub) =>
            sub
                .setName('propose')
                .setDescription('Propose marriage to another user')
                .setDescriptionLocalizations({
                    fr: 'Faire une demande en mariage à un autre utilisateur',
                })
                .addUserOption((option) =>
                    option
                        .setName('user')
                        .setDescription('The user to propose to')
                        .setDescriptionLocalizations({
                            fr: "L'utilisateur à qui faire votre demande",
                        })
                        .setRequired(true)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName('divorce')
                .setDescription('Divorce your current partner')
                .setDescriptionLocalizations({
                    fr: 'Divorcer de votre partenaire actuel',
                })
        )
        .addSubcommand((sub) =>
            sub
                .setName('status')
                .setDescription('View marriage status')
                .setDescriptionLocalizations({
                    fr: 'Voir le statut matrimonial',
                })
                .addUserOption((option) =>
                    option
                        .setName('user')
                        .setDescription('The user to check')
                        .setDescriptionLocalizations({
                            fr: "L'utilisateur à vérifier",
                        })
                        .setRequired(false)
                )
        ),
    execute: createCommandHandler(
        async (interaction: ChatInputCommandInteraction, lang: string) => {
            const subcommand = interaction.options.getSubcommand();
            // Marriages are global, so every subcommand works identically in
            // a guild channel or in a DM with the bot.
            const isDM = !interaction.inGuild();

            if (subcommand === 'propose') {
                const target = interaction.options.getUser('user', true);

                if (target.bot) {
                    const embed = EmbedUtils.error(
                        I18nService.translate('users:MARRY_BOT_ERROR', {
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
                if (target.id === interaction.user.id) {
                    const embed = EmbedUtils.error(
                        I18nService.translate('users:MARRY_SELF_ERROR', {
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
                if (await MarriageService.isMarried(interaction.user.id)) {
                    const embed = EmbedUtils.error(
                        I18nService.translate('users:MARRY_ALREADY_MARRIED', {
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
                if (await MarriageService.isMarried(target.id)) {
                    const embed = EmbedUtils.error(
                        I18nService.translate('users:MARRY_TARGET_MARRIED', {
                            lng: lang,
                            user: target.tag,
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

                const proposeGif = await getGif('kiss');
                const embed = EmbedUtils.base({
                    title: I18nService.translate('users:MARRY_PROPOSE_TITLE', {
                        lng: lang,
                    }),
                    description: I18nService.translate(
                        'users:MARRY_PROPOSE_DESC',
                        {
                            lng: lang,
                            proposer: interaction.user.toString(),
                            target: target.toString(),
                        }
                    ),
                    color: '#E91E8C',
                    user: interaction.user,
                }).setImage(proposeGif.url);
                const acceptBtn = new ButtonBuilder()
                    .setCustomId('marry_accept')
                    .setLabel('💍 Accept')
                    .setStyle(ButtonStyle.Success);
                const declineBtn = new ButtonBuilder()
                    .setCustomId('marry_decline')
                    .setLabel('💔 Decline')
                    .setStyle(ButtonStyle.Danger);
                const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                    acceptBtn,
                    declineBtn
                );

                // In a DM, the interaction's own reply channel is the
                // proposer's DM with the bot — the target would never see
                // it there. The interactive proposal has to be sent to the
                // target's DM directly instead, with a separate (ephemeral)
                // confirmation back to the proposer.
                let targetMessage: Message | InteractionResponse;
                if (isDM) {
                    try {
                        targetMessage = await target.send({
                            content: interaction.user.toString(),
                            embeds: [embed],
                            components: [row],
                        });
                    } catch {
                        const dmFailedEmbed = EmbedUtils.error(
                            I18nService.translate('users:MARRY_DM_FAILED', {
                                lng: lang,
                                user: target.tag,
                            }),
                            'Error',
                            interaction.user
                        );
                        await interaction.reply({
                            embeds: [dmFailedEmbed],
                            flags: MessageFlags.Ephemeral,
                        });
                        return;
                    }

                    const sentEmbed = EmbedUtils.info(
                        I18nService.translate('users:MARRY_PROPOSE_SENT', {
                            lng: lang,
                            user: target.toString(),
                        }),
                        'Proposal Sent',
                        interaction.user
                    );
                    await interaction.reply({
                        embeds: [sentEmbed],
                        flags: MessageFlags.Ephemeral,
                    });
                } else {
                    targetMessage = await interaction.reply({
                        content: target.toString(),
                        embeds: [embed],
                        components: [row],
                    });
                }

                /** Keeps the proposer's ephemeral confirmation in sync in DM mode. */
                const syncProposer = async (
                    resultEmbed: ReturnType<typeof EmbedUtils.info>
                ) => {
                    if (!isDM) return;
                    await interaction
                        .editReply({ embeds: [resultEmbed], components: [] })
                        .catch(() => {});
                };

                const collector = targetMessage.createMessageComponentCollector(
                    {
                        componentType: ComponentType.Button,
                        time: 60000,
                    }
                );

                collector.on('collect', async (i) => {
                    try {
                        if (i.user.id !== target.id) {
                            await i.reply({
                                content: I18nService.translate(
                                    'users:MARRY_BTN_NOT_TARGET',
                                    { lng: lang }
                                ),
                                flags: MessageFlags.Ephemeral,
                            });
                            return;
                        }

                        if (i.customId === 'marry_accept') {
                            try {
                                await MarriageService.marry(
                                    interaction.user.id,
                                    target.id
                                );
                                const successGif = await getGif('kiss');
                                const successEmbed = EmbedUtils.success(
                                    I18nService.translate(
                                        'users:MARRY_SUCCESS',
                                        {
                                            lng: lang,
                                            user1: interaction.user.toString(),
                                            user2: target.toString(),
                                        }
                                    ),
                                    'Congratulations!',
                                    interaction.user
                                ).setImage(successGif.url);
                                await i.update({
                                    content: '',
                                    embeds: [successEmbed],
                                    components: [],
                                });
                                await syncProposer(successEmbed);
                            } catch (err: unknown) {
                                const msg =
                                    err instanceof MarriageError
                                        ? I18nService.translate(
                                              `users:MARRY_${err.code.replace('MARRIAGE_ERR_', '')}`,
                                              { lng: lang }
                                          )
                                        : I18nService.translate(
                                              'common:ERROR_GENERIC',
                                              { lng: lang }
                                          );
                                const errEmbed = EmbedUtils.error(
                                    msg,
                                    'Error',
                                    interaction.user
                                );
                                await i.update({
                                    content: '',
                                    embeds: [errEmbed],
                                    components: [],
                                });
                                await syncProposer(errEmbed);
                            }
                        } else {
                            const declinedEmbed = EmbedUtils.info(
                                I18nService.translate('users:MARRY_DECLINED', {
                                    lng: lang,
                                    user: target.toString(),
                                }),
                                'Proposal Declined',
                                interaction.user
                            );
                            await i.update({
                                content: '',
                                embeds: [declinedEmbed],
                                components: [],
                            });
                            await syncProposer(declinedEmbed);
                        }
                        collector.stop();
                    } catch (error) {
                        logger.error(
                            '[Marry] Failed to process proposal response',
                            error
                        );
                    }
                });

                collector.on('end', async (_, reason) => {
                    if (reason !== 'time') return;

                    const timeoutEmbed = EmbedUtils.warn(
                        I18nService.translate('users:MARRY_TIMEOUT', {
                            lng: lang,
                        }),
                        'Timeout',
                        interaction.user
                    );

                    await targetMessage
                        .edit({
                            content: '',
                            embeds: [timeoutEmbed],
                            components: [],
                        })
                        .catch(() => {});
                    await syncProposer(timeoutEmbed);
                });
            } else if (subcommand === 'divorce') {
                try {
                    const partnerId = await MarriageService.divorce(
                        interaction.user.id
                    );
                    const embed = EmbedUtils.success(
                        I18nService.translate('users:MARRY_DIVORCE_SUCCESS', {
                            lng: lang,
                            partner: `<@${partnerId}>`,
                        }),
                        'Divorced',
                        interaction.user
                    );
                    await interaction.reply({ embeds: [embed] });
                } catch (err: unknown) {
                    const msg =
                        err instanceof MarriageError
                            ? I18nService.translate('users:MARRY_NOT_MARRIED', {
                                  lng: lang,
                              })
                            : I18nService.translate('common:ERROR_GENERIC', {
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
            } else if (subcommand === 'status') {
                const target =
                    interaction.options.getUser('user') || interaction.user;
                const marriage = await MarriageService.getMarriage(target.id);
                if (!marriage) {
                    const embed = EmbedUtils.info(
                        I18nService.translate('users:MARRY_STATUS_SINGLE', {
                            lng: lang,
                            user: target.toString(),
                        }),
                        'Marriage Status',
                        interaction.user
                    );
                    await interaction.reply({ embeds: [embed] });
                    return;
                }
                const partnerId =
                    marriage.user1Id === target.id
                        ? marriage.user2Id
                        : marriage.user1Id;
                const embed = EmbedUtils.info(
                    I18nService.translate('users:MARRY_STATUS_MARRIED', {
                        lng: lang,
                        user: target.toString(),
                        partner: `<@${partnerId}>`,
                        date: `<t:${Math.floor(marriage.marriedAt.getTime() / 1000)}:D>`,
                    }),
                    'Marriage Status',
                    interaction.user
                );
                await interaction.reply({ embeds: [embed] });
            }
        }
    ),
};

export default command;
