import {
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    MessageFlags,
} from 'discord.js';
import { type Command } from '@/types/Command.js';
import { createCommandHandler } from '@/utils/commandHandler.js';
import { EconomyService } from '@/services/EconomyService.js';
import { EmbedUtils } from '@/utils/EmbedUtils.js';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('history')
        .setDescription('View your recent economy transactions')
        .setDescriptionLocalizations({
            fr: 'Voir vos transactions économiques récentes',
        })
        .addUserOption((opt) =>
            opt
                .setName('user')
                .setDescription('User to view history for (optional)')
                .setDescriptionLocalizations({
                    fr: "Utilisateur dont voir l'historique (optionnel)",
                })
                .setRequired(false)
        ),

    execute: createCommandHandler(
        async (interaction: ChatInputCommandInteraction, lang: string) => {
            const guildId = interaction.guildId ?? 'dm';
            const targetUser =
                interaction.options.getUser('user') || interaction.user;
            const history = await EconomyService.getRecentTransactions(
                targetUser.id,
                guildId,
                10
            );

            if (history.length === 0) {
                const embed = EmbedUtils.base({
                    title:
                        lang === 'fr'
                            ? 'Historique des transactions'
                            : 'Transaction History',
                    description:
                        lang === 'fr'
                            ? 'Aucune transaction récente.'
                            : 'No recent transactions.',
                    color: '#3498DB',
                    user: interaction.user,
                }).setThumbnail(targetUser.displayAvatarURL());

                await interaction.reply({
                    embeds: [embed],
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            let desc = '';
            for (const tx of history) {
                const date = `<t:${Math.floor(tx.createdAt.getTime() / 1000)}:R>`;
                const amountStr =
                    tx.amount > 0 ? `+${tx.amount} 💰` : `${tx.amount} 💰`;
                const typeEmoji = getEmojiForType(tx.type);
                desc += `${typeEmoji} **${tx.type.toUpperCase()}** | ${amountStr} | ${date}\n`;
                if (tx.details) {
                    desc += `└ *${tx.details}*\n\n`;
                } else {
                    desc += '\n';
                }
            }

            const embed = EmbedUtils.base({
                title:
                    lang === 'fr'
                        ? `Historique de ${targetUser.username}`
                        : `${targetUser.username}'s History`,
                description: desc,
                color: '#3498DB',
                user: interaction.user,
            }).setThumbnail(targetUser.displayAvatarURL());

            await interaction.reply({
                embeds: [embed],
                flags: MessageFlags.Ephemeral,
            });
        }
    ),
};

function getEmojiForType(type: string): string {
    switch (type) {
        case 'add_balance':
        case 'daily':
        case 'quest_reward':
        case 'event_reward':
            return '🎁';
        case 'remove_balance':
            return '🔥';
        case 'pay':
            return '💸';
        case 'bank_deposit':
            return '🏦';
        case 'bank_withdraw':
            return '🏧';
        case 'rob':
        case 'robbed':
            return '🦹';
        case 'work':
            return '💼';
        case 'casino':
            return '🎰';
        default:
            return '💳';
    }
}

export default command;
