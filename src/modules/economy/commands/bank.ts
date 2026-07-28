import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../../types/Command.js';
import { I18nService } from '../../../services/I18nService.js';
import { EconomyService } from '../../../services/EconomyService.js';
import { EmbedUtils } from '../../../utils/EmbedUtils.js';
import { createCommandHandler } from '../../../utils/index.js';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('bank')
        .setDescription('Manage your bank account')
        .setNameLocalizations({ fr: 'banque' })
        .setDescriptionLocalizations({ fr: 'Gérer votre compte en banque' })
        .addSubcommand((subcommand) =>
            subcommand
                .setName('deposit')
                .setDescription('Deposit money into your bank account')
                .setNameLocalizations({ fr: 'deposer' })
                .setDescriptionLocalizations({ fr: 'Déposer de l\'argent sur votre compte en banque' })
                .addIntegerOption((option) =>
                    option
                        .setName('amount')
                        .setDescription('Amount to deposit')
                        .setNameLocalizations({ fr: 'montant' })
                        .setDescriptionLocalizations({ fr: 'Montant à déposer' })
                        .setRequired(true)
                        .setMinValue(1)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('withdraw')
                .setDescription('Withdraw money from your bank account')
                .setNameLocalizations({ fr: 'retirer' })
                .setDescriptionLocalizations({ fr: 'Retirer de l\'argent de votre compte en banque' })
                .addIntegerOption((option) =>
                    option
                        .setName('amount')
                        .setDescription('Amount to withdraw')
                        .setNameLocalizations({ fr: 'montant' })
                        .setDescriptionLocalizations({ fr: 'Montant à retirer' })
                        .setRequired(true)
                        .setMinValue(1)
                )
        ),
    execute: createCommandHandler(async (interaction: ChatInputCommandInteraction, lang: string) => {
        const subcommand = interaction.options.getSubcommand();
        const amount = interaction.options.getInteger('amount', true);

        if (subcommand === 'deposit') {
            await EconomyService.deposit(interaction.user.id, amount);
            const msg = I18nService.translate('common:BANK_DEPOSIT_SUCCESS', {
                lng: lang,
                amount
            });
            const embed = EmbedUtils.success(msg, I18nService.translate('common:EMBED_TITLE_BANK', { lng: lang }), interaction.user);
            await interaction.reply({ embeds: [embed] });
        } else if (subcommand === 'withdraw') {
            await EconomyService.withdraw(interaction.user.id, amount);
            const msg = I18nService.translate('common:BANK_WITHDRAW_SUCCESS', {
                lng: lang,
                amount
            });
            const embed = EmbedUtils.success(msg, I18nService.translate('common:EMBED_TITLE_BANK', { lng: lang }), interaction.user);
            await interaction.reply({ embeds: [embed] });
        }
    }),
};

export default command;
