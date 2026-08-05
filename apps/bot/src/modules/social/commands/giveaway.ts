import { createCommandHandler } from '@/utils/index.js';
import {
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
} from 'discord.js';
import type { Command } from '@/types/Command.js';
import { I18nService } from '@/services/I18nService.js';
import { EmbedUtils } from '@/utils/EmbedUtils.js';
import { GiveawayError } from '@/utils/errors.js';
import { GiveawayService } from '@/services/GiveawayService.js';
import { GiveawayDrawJob } from '@/jobs/GiveawayDrawJob.js';
import { buildGiveawayEmbed, buildGiveawayJoinRow } from '../embeds.js';

async function replyGiveawayError(
    interaction: ChatInputCommandInteraction,
    error: unknown,
    lang: string
) {
    // commandHandler.ts's generic AppError fallback only checks the
    // 'common' namespace, so GiveawayError must be translated manually here.
    const msg =
        error instanceof GiveawayError
            ? I18nService.translate(`social:${error.code}`, {
                  lng: lang,
                  ...error.meta,
              })
            : I18nService.translate('common:ERROR_GENERIC', { lng: lang });
    await interaction.reply({
        embeds: [EmbedUtils.error(msg, 'Error', interaction.user)],
        flags: MessageFlags.Ephemeral,
    });
}

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('Manage server giveaways')
        .setDescriptionLocalizations({ fr: 'Gérer les giveaways du serveur' })
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand((sub) =>
            sub
                .setName('start')
                .setDescription('Start a new giveaway')
                .setDescriptionLocalizations({
                    fr: 'Lancer un nouveau giveaway',
                })
                .addStringOption((option) =>
                    option
                        .setName('prize')
                        .setDescription('What is being given away')
                        .setDescriptionLocalizations({
                            fr: 'Ce qui est à gagner',
                        })
                        .setRequired(true)
                )
                .addIntegerOption((option) =>
                    option
                        .setName('duration')
                        .setDescription('Duration in minutes')
                        .setDescriptionLocalizations({
                            fr: 'Durée en minutes',
                        })
                        .setRequired(true)
                        .setMinValue(1)
                )
                .addIntegerOption((option) =>
                    option
                        .setName('winners')
                        .setDescription('Number of winners')
                        .setDescriptionLocalizations({
                            fr: 'Nombre de gagnants',
                        })
                        .setRequired(true)
                        .setMinValue(1)
                )
                .addRoleOption((option) =>
                    option
                        .setName('required_role')
                        .setDescription('Role required to enter (optional)')
                        .setDescriptionLocalizations({
                            fr: 'Rôle requis pour participer (optionnel)',
                        })
                        .setRequired(false)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName('end')
                .setDescription('End a giveaway early')
                .setDescriptionLocalizations({
                    fr: 'Terminer un giveaway de manière anticipée',
                })
                .addIntegerOption((option) =>
                    option
                        .setName('id')
                        .setDescription('The giveaway ID')
                        .setDescriptionLocalizations({
                            fr: "L'ID du giveaway",
                        })
                        .setRequired(true)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName('reroll')
                .setDescription('Redraw all winners of an ended giveaway')
                .setDescriptionLocalizations({
                    fr: "Retirer au sort tous les gagnants d'un giveaway terminé",
                })
                .addIntegerOption((option) =>
                    option
                        .setName('id')
                        .setDescription('The giveaway ID')
                        .setDescriptionLocalizations({
                            fr: "L'ID du giveaway",
                        })
                        .setRequired(true)
                )
        ),
    execute: createCommandHandler(
        async (interaction: ChatInputCommandInteraction, lang: string) => {
            const guildId = interaction.guildId;
            if (!guildId) return;
            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'start') {
                const prize = interaction.options.getString('prize', true);
                const duration = interaction.options.getInteger(
                    'duration',
                    true
                );
                const winners = interaction.options.getInteger('winners', true);
                const role = interaction.options.getRole('required_role');

                const endsAt = new Date(Date.now() + duration * 60000);
                const giveaway = await GiveawayService.create({
                    guildId,
                    channelId: interaction.channelId,
                    hostId: interaction.user.id,
                    prize,
                    winnerCount: winners,
                    requiredRoleId: role?.id ?? null,
                    endsAt,
                });

                const embed = buildGiveawayEmbed(giveaway, lang);
                const row = buildGiveawayJoinRow(giveaway.id, lang);
                const channel =
                    interaction.channel ??
                    (await interaction.client.channels
                        .fetch(interaction.channelId)
                        .catch(() => null));
                const message =
                    channel && channel.isSendable()
                        ? await channel.send({
                              embeds: [embed],
                              components: [row],
                          })
                        : null;
                if (message) {
                    await GiveawayService.attachMessage(
                        giveaway.id,
                        message.id
                    );
                }

                const msg = I18nService.translate(
                    'social:GIVEAWAY_START_SUCCESS',
                    { lng: lang, channel: `<#${interaction.channelId}>` }
                );
                const successEmbed = EmbedUtils.success(
                    `${msg} (ID: \`${giveaway.id}\`)`,
                    'Giveaway',
                    interaction.user
                );
                await interaction.reply({
                    embeds: [successEmbed],
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            if (subcommand === 'end') {
                const id = interaction.options.getInteger('id', true);
                try {
                    const { winnerIds } = await GiveawayService.endEarly(id);
                    await GiveawayDrawJob.announce(id, winnerIds);
                    const msg = I18nService.translate(
                        'social:GIVEAWAY_END_SUCCESS',
                        { lng: lang }
                    );
                    await interaction.reply({
                        embeds: [
                            EmbedUtils.success(
                                msg,
                                'Giveaway',
                                interaction.user
                            ),
                        ],
                        flags: MessageFlags.Ephemeral,
                    });
                } catch (error) {
                    await replyGiveawayError(interaction, error, lang);
                }
                return;
            }

            if (subcommand === 'reroll') {
                const id = interaction.options.getInteger('id', true);
                try {
                    const { winnerIds } = await GiveawayService.reroll(id);
                    await GiveawayDrawJob.announce(id, winnerIds);
                    const msg = I18nService.translate(
                        'social:GIVEAWAY_REROLL_SUCCESS',
                        {
                            lng: lang,
                            winners: winnerIds.map((w) => `<@${w}>`).join(', '),
                        }
                    );
                    await interaction.reply({
                        embeds: [
                            EmbedUtils.success(
                                msg,
                                'Giveaway',
                                interaction.user
                            ),
                        ],
                        flags: MessageFlags.Ephemeral,
                    });
                } catch (error) {
                    await replyGiveawayError(interaction, error, lang);
                }
            }
        }
    ),
};

export default command;
