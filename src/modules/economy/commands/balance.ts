import { createCommandHandler } from '../../../utils/index.js';
import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    SlashCommandBuilder,
} from 'discord.js';
import type { Command } from '../../../types/Command.js';
import { I18nService } from '../../../services/I18nService.js';
import { GuildConfigService } from '../../../services/GuildConfigService.js';
import { EconomyService } from '../../../services/EconomyService.js';
import { EmbedUtils } from '../../../utils/EmbedUtils.js';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setNameLocalizations({ fr: 'solde' })
        .setDescription("Check your or someone else's balance")
        .setDescriptionLocalizations({
            fr: "Voir votre solde ou celui de quelqu'un d'autre",
        })
        .addUserOption((option) =>
            option
                .setName('user')
                .setNameLocalizations({ fr: 'utilisateur' })
                .setDescription('The user to check the balance of')
                .setDescriptionLocalizations({
                    fr: "L'utilisateur dont vous souhaitez voir le solde",
                })
                .setRequired(false)
        ),
    execute: createCommandHandler(async (interaction: ChatInputCommandInteraction, lang: string) => {
        const targetUser =
            interaction.options.getUser('user') || interaction.user;
        const { balance, bank } = await EconomyService.getBalance(
            targetUser.id
        );
        const title = I18nService.translate('common:BALANCE_TITLE', {
            lng: lang,
            user: targetUser.username,
        });
        const walletLabel = I18nService.translate('common:BALANCE_WALLET', {
            lng: lang,
        });
        const bankLabel = I18nService.translate('common:BALANCE_BANK', {
            lng: lang,
        });
        const totalLabel = I18nService.translate('common:BALANCE_TOTAL', {
            lng: lang,
        });
        const embed = EmbedUtils.base({
            title,
            color: '#FFD700',
            user: interaction.user,
        })
            .addFields(
                { name: walletLabel, value: `${balance}`, inline: true },
                { name: bankLabel, value: `${bank}`, inline: true },
                { name: totalLabel, value: `${balance + bank} `, inline: true }
            )
            .setThumbnail(targetUser.displayAvatarURL());
        await interaction.reply({ embeds: [embed] });
    }),
};

export default command;
