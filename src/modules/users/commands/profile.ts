import { createCommandHandler } from '../../../utils/index.js';
import {
    MessageFlags,
    ChatInputCommandInteraction,
    SlashCommandBuilder,
} from 'discord.js';
import type { Command } from '../../../types/Command.js';
import { I18nService } from '../../../services/I18nService.js';
import { ProfileService } from '../../../services/ProfileService.js';
import { EmbedUtils } from '../../../utils/EmbedUtils.js';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setNameLocalizations({ fr: 'profil' })
        .setDescription('View your profile and statistics')
        .setDescriptionLocalizations({
            fr: 'Voir votre profil et vos statistiques',
        })
        .addUserOption((option) =>
            option
                .setName('user')
                .setNameLocalizations({ fr: 'utilisateur' })
                .setDescription('The user to view')
                .setDescriptionLocalizations({ fr: "L'utilisateur à voir" })
                .setRequired(false)
        ),
    execute: createCommandHandler(
        async (interaction: ChatInputCommandInteraction, lang: string) => {
            const guildId = interaction.guildId ?? 'dm';
            const targetUser =
                interaction.options.getUser('user') || interaction.user;
            if (targetUser.bot) {
                const embed = EmbedUtils.error(
                    I18nService.translate('users:PROFILE_BOT_ERROR', {
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
            const profile = await ProfileService.getProfile(
                targetUser.id,
                guildId
            );
            // Translation strings (will add to JSONs next)
            const title = I18nService.translate('users:PROFILE_TITLE', {
                lng: lang,
                user: targetUser.username,
            });
            const generalHeader = I18nService.translate(
                'users:PROFILE_GENERAL',
                {
                    lng: lang,
                }
            );
            const levelLabel = I18nService.translate('users:PROFILE_LEVEL', {
                lng: lang,
            });
            const xpLabel = I18nService.translate('users:PROFILE_XP', {
                lng: lang,
            });
            const wealthHeader = I18nService.translate('users:PROFILE_WEALTH', {
                lng: lang,
            });
            const walletLabel = I18nService.translate('users:PROFILE_WALLET', {
                lng: lang,
            });
            const bankLabel = I18nService.translate('users:PROFILE_BANK', {
                lng: lang,
            });
            const totalLabel = I18nService.translate('users:PROFILE_TOTAL', {
                lng: lang,
            });
            const workHeader = I18nService.translate('users:PROFILE_WORK', {
                lng: lang,
            });
            const jobLabel = I18nService.translate('users:PROFILE_JOB', {
                lng: lang,
            });
            const shiftsLabel = I18nService.translate('users:PROFILE_SHIFTS', {
                lng: lang,
            });
            const casinoHeader = I18nService.translate('users:PROFILE_CASINO', {
                lng: lang,
            });
            const gamesLabel = I18nService.translate('users:PROFILE_GAMES', {
                lng: lang,
            });
            const winrateLabel = I18nService.translate(
                'users:PROFILE_WINRATE',
                {
                    lng: lang,
                }
            );
            const wlrLabel = I18nService.translate('users:PROFILE_WLR', {
                lng: lang,
            }); // Wins/Losses
            // Format Dates
            const joinedStr = `<t:${Math.floor(profile.createdAt.getTime() / 1000)}:R>`;
            const embed = EmbedUtils.base({
                title,
                color: '#9B59B6',
                user: interaction.user,
            })
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    {
                        name: `${generalHeader}`,
                        value: `**${levelLabel}:** ${profile.level}\n**${xpLabel}:** ${profile.experience}\n**Joined:** ${joinedStr}`,
                        inline: false,
                    },
                    {
                        name: `${wealthHeader}`,
                        value: `**${walletLabel}:** ${profile.economy.balance}\n**${bankLabel}:** ${profile.economy.bank}\n**${totalLabel}:** ${profile.economy.total} 💸`,
                        inline: true,
                    },
                    {
                        name: `${workHeader}`,
                        value: `**${jobLabel}:** ${profile.work.jobTitle}\n**${shiftsLabel}:** ${profile.work.shiftsDone}`,
                        inline: true,
                    },
                    {
                        name: `${casinoHeader}`,
                        value: `**${gamesLabel}:** ${profile.casino.gamesPlayed}\n**${winrateLabel}:** ${profile.casino.winRate}%\n**${wlrLabel}:** ${profile.casino.wins}W / ${profile.casino.losses}L`,
                        inline: true,
                    }
                )
                .setFooter({ text: `ID: ${targetUser.id}` });
            await interaction.reply({ embeds: [embed] });
        }
    ),
};

export default command;
