import {
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from 'discord.js';
import { type Command } from '../../../types/Command.js';
import { createCommandHandler } from '../../../utils/commandHandler.js';
import { ModerationService } from '../../../services/ModerationService.js';
import { EmbedUtils } from '../../../utils/EmbedUtils.js';
import { EconomyService } from '../../../services/EconomyService.js';
import { I18nService } from '../../../services/I18nService.js';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('syncbans')
        .setDescription('Synchronize native Discord bans with the database')
        .setDescriptionLocalizations({
            fr: 'Synchroniser les bans Discord natifs avec la base de données',
        })
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    execute: createCommandHandler(
        async (interaction: ChatInputCommandInteraction, lang: string) => {
            if (!interaction.guild) return;

            try {
                const bans = await interaction.guild.bans.fetch();
                const loggedUserIds = await ModerationService.getLoggedUserIds(
                    interaction.guild.id,
                    'BAN'
                );
                let synced = 0;

                for (const ban of bans.values()) {
                    if (!loggedUserIds.has(ban.user.id)) {
                        await EconomyService.ensureUser(
                            ban.user.id,
                            interaction.guild.id
                        );
                        await ModerationService.logAction(
                            interaction.guild.id,
                            ban.user.id,
                            interaction.client.user.id, // Log as the bot
                            'BAN',
                            ban.reason || 'Synced native ban'
                        );
                        synced++;
                    }
                }

                const embed = EmbedUtils.success(
                    I18nService.translate('mod:SYNCBANS_SUCCESS', {
                        lng: lang,
                        count: synced,
                    }),
                    'Bans Synchronized',
                    interaction.user
                );

                await interaction.editReply({
                    embeds: [embed],
                });
            } catch (error) {
                const embed = EmbedUtils.error(
                    I18nService.translate('mod:SYNCBANS_ERROR', { lng: lang }),
                    'Sync Error',
                    interaction.user
                );
                await interaction.editReply({
                    embeds: [embed],
                });
            }
        },
        { defer: true, ephemeral: true }
    ),
};

export default command;
