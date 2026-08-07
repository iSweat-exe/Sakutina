import {
    ChatInputCommandInteraction,
    MessageFlags,
    SlashCommandBuilder,
} from 'discord.js';
import type { Command } from '@/types/Command.js';
import { I18nService } from '@/services/I18nService.js';
import { EconomyService } from '@/services/EconomyService.js';
import { EmbedUtils } from '@/utils/EmbedUtils.js';
import { createCommandHandler } from '@/utils/index.js';
import { CooldownError, EmptyWalletError } from '@/utils/errors.js';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('rob')
        .setDescription("Steal 1-5% of a user's wallet balance (24h cooldown)")
        .setDescriptionLocalizations({
            fr: "Voler 1-5% du portefeuille d'un joueur (cooldown 24h)",
        })
        .addUserOption((option) =>
            option
                .setName('user')
                .setDescription('The user to rob')
                .setDescriptionLocalizations({ fr: "L'utilisateur à voler" })
                .setRequired(true)
        ),
    execute: createCommandHandler(
        async (interaction: ChatInputCommandInteraction, lang: string) => {
            const guildId = interaction.guildId ?? 'dm';
            const target = interaction.options.getUser('user', true);

            if (target.bot) {
                const embed = EmbedUtils.error(
                    I18nService.translate('economy:ROB_BOT_ERROR', {
                        lng: lang,
                    }),
                    I18nService.translate('common:EMBED_TITLE_ERROR', {
                        lng: lang,
                    }),
                    interaction.user
                );
                await interaction.reply({ embeds: [embed] });
                return;
            }

            try {
                const stolen = await EconomyService.rob(
                    interaction.user.id,
                    target.id,
                    guildId
                );
                const msg = I18nService.translate('economy:ROB_SUCCESS', {
                    lng: lang,
                    amount: stolen,
                    target: target.toString(),
                });
                const embed = EmbedUtils.success(
                    msg,
                    I18nService.translate('common:EMBED_TITLE_ROB_SUCCESS', {
                        lng: lang,
                    }),
                    interaction.user
                );
                await interaction.reply({ embeds: [embed] });
            } catch (error: unknown) {
                let msg = I18nService.translate('common:ERROR_GENERIC', {
                    lng: lang,
                });
                if (error instanceof EmptyWalletError) {
                    msg = I18nService.translate('economy:EMPTY_WALLET', {
                        lng: lang,
                    });
                } else if (error instanceof CooldownError) {
                    msg = I18nService.translate('economy:ROB_COOLDOWN', {
                        lng: lang,
                        ...error.meta,
                    });
                }
                const embed = EmbedUtils.error(
                    msg,
                    I18nService.translate('common:EMBED_TITLE_ERROR', {
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
