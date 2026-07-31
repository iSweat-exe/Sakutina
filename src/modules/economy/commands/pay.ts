import { createCommandHandler } from '../../../utils/index.js';
import {
    ChatInputCommandInteraction,
    MessageFlags,
    SlashCommandBuilder,
} from 'discord.js';
import type { Command } from '../../../types/Command.js';
import { I18nService } from '../../../services/I18nService.js';
import { EconomyService } from '../../../services/EconomyService.js';
import { EmbedUtils } from '../../../utils/EmbedUtils.js';
import {
    CannotPaySelfError,
    InsufficientFundsError,
} from '../../../utils/errors.js';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('pay')
        .setNameLocalizations({ fr: 'payer' })
        .setDescription('Pay another user some coins')
        .setDescriptionLocalizations({
            fr: 'Payer quelques pièces à un autre utilisateur',
        })
        .addUserOption((option) =>
            option
                .setName('user')
                .setNameLocalizations({ fr: 'utilisateur' })
                .setDescription('The user to pay')
                .setDescriptionLocalizations({ fr: "L'utilisateur à payer" })
                .setRequired(true)
        )
        .addIntegerOption((option) =>
            option
                .setName('amount')
                .setNameLocalizations({ fr: 'montant' })
                .setDescription('Amount to pay')
                .setDescriptionLocalizations({ fr: 'Montant à payer' })
                .setRequired(true)
                .setMinValue(1)
        ),
    execute: createCommandHandler(
        async (interaction: ChatInputCommandInteraction, lang: string) => {
            const guildId = interaction.guildId ?? 'dm';
            const targetUser = interaction.options.getUser('user', true);
            const amount = interaction.options.getInteger('amount', true);
            if (targetUser.bot) {
                const msg = I18nService.translate('economy:PAY_BOT_ERROR', {
                    lng: lang,
                });
                const embed = EmbedUtils.error(msg, 'Error', interaction.user);
                await interaction.reply({
                    embeds: [embed],
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }
            try {
                await EconomyService.payUser(
                    interaction.user.id,
                    targetUser.id,
                    guildId,
                    amount
                );
                const msg = I18nService.translate('economy:PAY_SUCCESS', {
                    lng: lang,
                    amount,
                    user: targetUser.toString(),
                });
                const embed = EmbedUtils.success(
                    msg,
                    'Payment Sent',
                    interaction.user
                );
                await interaction.reply({ embeds: [embed] });
            } catch (error: unknown) {
                if (error instanceof CannotPaySelfError) {
                    const msg = I18nService.translate(
                        'economy:PAY_SELF_ERROR',
                        {
                            lng: lang,
                        }
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
                } else if (error instanceof InsufficientFundsError) {
                    const msg = I18nService.translate(
                        'economy:INSUFFICIENT_FUNDS',
                        {
                            lng: lang,
                        }
                    );
                    const embed = EmbedUtils.error(
                        msg,
                        'Insufficient Funds',
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
