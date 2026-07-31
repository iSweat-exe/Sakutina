import { ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder, MessageFlags } from 'discord.js';
import { type Command } from '../../../types/Command.js';
import { createCommandHandler } from '../../../utils/commandHandler.js';
import { ModerationService } from '../../../services/ModerationService.js';
import { EmbedUtils } from '../../../utils/EmbedUtils.js';
import { EconomyService } from '../../../services/EconomyService.js';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('syncbans')
        .setDescription('Synchronize native Discord bans with the database')
        .setDescriptionLocalizations({ fr: 'Synchroniser les bans Discord natifs avec la base de données' })
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    execute: createCommandHandler(async (interaction: ChatInputCommandInteraction, lang: string) => {
        if (!interaction.guild) return;
        
        try {
            const bans = await interaction.guild.bans.fetch();
            let synced = 0;
            
            for (const ban of bans.values()) {
                const history = await ModerationService.getModHistory(interaction.guild.id, ban.user.id);
                const isAlreadyLogged = history.some(h => h.actionType === 'BAN');
                
                if (!isAlreadyLogged) {
                    await EconomyService.ensureUser(ban.user.id, interaction.guild.id);
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
                `Successfully synchronized **${synced}** bans with the database.`,
                'Bans Synchronized',
                interaction.user
            );

            await interaction.editReply({
                embeds: [embed]
            });
        } catch (error) {
            const embed = EmbedUtils.error(
                'An error occurred while fetching or syncing the bans.',
                'Sync Error',
                interaction.user
            );
            await interaction.editReply({
                embeds: [embed]
            });
        }
    }, { defer: true, ephemeral: true })
};

export default command;
