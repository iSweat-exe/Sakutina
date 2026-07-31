import { createCommandHandler } from '../../../utils/index.js';
import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    MessageFlags,
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
} from 'discord.js';
import type { Command } from '../../../types/Command.js';
import { I18nService } from '../../../services/I18nService.js';
import { CasinoService } from '../../../services/CasinoService.js';
import { GuildConfigService } from '../../../services/GuildConfigService.js';
import { EconomyService } from '../../../services/EconomyService.js';
import { EmbedUtils } from '../../../utils/EmbedUtils.js';
import { InsufficientFundsError } from '../../../utils/errors.js';
import { QuestService } from '../../../services/QuestService.js';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('casino')
        .setNameLocalizations({ fr: 'casino' })
        .setDescription('Play casino minigames')
        .setDescriptionLocalizations({ fr: 'Jouer aux mini-jeux du casino' })
        .addSubcommand((subcommand) =>
            subcommand
                .setName('doubleornothing')
                .setNameLocalizations({ fr: 'quitteoudouble' })
                .setDescription('50% chance to double your bet')
                .setDescriptionLocalizations({
                    fr: '50% de chance de doubler votre mise',
                })
                .addIntegerOption((option) =>
                    option
                        .setName('bet')
                        .setNameLocalizations({ fr: 'mise' })
                        .setDescription('Amount to bet')
                        .setDescriptionLocalizations({ fr: 'Montant à miser' })
                        .setRequired(true)
                        .setMinValue(1)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('coinflip')
                .setNameLocalizations({ fr: 'pileouface' })
                .setDescription('Bet on heads or tails')
                .setDescriptionLocalizations({ fr: 'Parier sur pile ou face' })
                .addIntegerOption((option) =>
                    option
                        .setName('bet')
                        .setNameLocalizations({ fr: 'mise' })
                        .setDescription('Amount to bet')
                        .setDescriptionLocalizations({ fr: 'Montant à miser' })
                        .setRequired(true)
                        .setMinValue(1)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('rps')
                .setNameLocalizations({ fr: 'pfc' })
                .setDescription('Rock Paper Scissors against the bot')
                .setDescriptionLocalizations({
                    fr: 'Pierre Papier Ciseaux contre le bot',
                })
                .addIntegerOption((option) =>
                    option
                        .setName('bet')
                        .setNameLocalizations({ fr: 'mise' })
                        .setDescription('Amount to bet')
                        .setDescriptionLocalizations({ fr: 'Montant à miser' })
                        .setRequired(true)
                        .setMinValue(1)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('slots')
                .setNameLocalizations({ fr: 'machineasous' })
                .setDescription('Play the slot machine')
                .setDescriptionLocalizations({
                    fr: 'Jouer à la machine à sous',
                })
                .addIntegerOption((option) =>
                    option
                        .setName('bet')
                        .setNameLocalizations({ fr: 'mise' })
                        .setDescription('Amount to bet')
                        .setDescriptionLocalizations({ fr: 'Montant à miser' })
                        .setRequired(true)
                        .setMinValue(1)
                )
        ),
    execute: createCommandHandler(async (interaction: ChatInputCommandInteraction, lang: string) => {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guildId ?? 'dm';
        const bet = interaction.options.getInteger('bet', true);
        try {
            if (subcommand === 'doubleornothing') {
                const result = await CasinoService.doubleOrNothing(
                    interaction.user.id,
                    guildId,
                    bet
                );
                if (result.win) {
                    const msg = I18nService.translate('economy:CASINO_DON_WIN', {
                        lng: lang,
                        bet,
                        won: result.amount,
                    });
                    const embed = EmbedUtils.success(
                        msg,
                        'You Won!',
                        interaction.user
                    );
                    await interaction.reply({ embeds: [embed] });
                } else {
                    const msg = I18nService.translate(
                        'economy:CASINO_DON_LOSE',
                        { lng: lang, bet }
                    );
                    const embed = EmbedUtils.error(
                        msg,
                        'You Lost',
                        interaction.user
                    );
                    await interaction.reply({ embeds: [embed] });
                }
                await QuestService.incrementProgress(interaction.user.id, guildId, 'casino').catch(() => {});
            } else if (subcommand === 'coinflip') {
                const balanceData = await EconomyService.getBalance(
                    interaction.user.id,
                    guildId
                );
                if (balanceData.balance < bet) {
                    throw new InsufficientFundsError();
                }
                const embed = EmbedUtils.base({
                    title: ' Coinflip',
                    color: '#F1C40F',
                    user: interaction.user,
                }).setDescription(
                    lang === 'fr'
                        ? `Pile ou Face ? Mise : **${bet}**`
                        : `Heads or Tails? Bet: **${bet}**`
                );
                const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                        .setCustomId('coin_heads')
                        .setLabel(lang === 'fr' ? 'Face' : 'Heads')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('coin_tails')
                        .setLabel(lang === 'fr' ? 'Pile' : 'Tails')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('coin_cancel')
                        .setLabel(lang === 'fr' ? 'Annuler ❌' : 'Cancel ❌')
                        .setStyle(ButtonStyle.Danger)
                );
                const response = await interaction.reply({
                    embeds: [embed],
                    components: [row],
                });
                try {
                    const confirmation = await response.awaitMessageComponent({
                        filter: (i) => i.user.id === interaction.user.id,
                        time: 60000,
                        componentType: ComponentType.Button,
                    });
                    if (confirmation.customId === 'coin_cancel') {
                        const cancelEmbed = EmbedUtils.warn(
                            lang === 'fr'
                                ? 'Partie annulée.'
                                : 'Game cancelled.',
                            'Cancelled',
                            interaction.user
                        );
                        await confirmation.update({
                            embeds: [cancelEmbed],
                            components: [],
                        });
                        return;
                    }
                    const choice = confirmation.customId.replace(
                        'coin_',
                        ''
                    ) as 'heads' | 'tails';
                    try {
                        const result = await CasinoService.coinflip(
                            interaction.user.id,
                            guildId,
                            bet,
                            choice
                        );
                        const localizedResult = I18nService.translate(
                            `economy:CASINO_COIN_${result.result.toUpperCase()}`,
                            { lng: lang }
                        );
                        if (result.win) {
                            const msg = I18nService.translate(
                                'economy:CASINO_COIN_WIN',
                                {
                                    lng: lang,
                                    bet,
                                    result: localizedResult,
                                    won: result.amount,
                                }
                            );
                            const embedWin = EmbedUtils.success(
                                msg,
                                'You Won!',
                                interaction.user
                            );
                            await confirmation.update({
                                embeds: [embedWin],
                                components: [],
                            });
                        } else {
                            const msg = I18nService.translate(
                                'economy:CASINO_COIN_LOSE',
                                { lng: lang, bet, result: localizedResult }
                            );
                            const embedLose = EmbedUtils.error(
                                msg,
                                'You Lost',
                                interaction.user
                            );
                            await confirmation.update({
                                embeds: [embedLose],
                                components: [],
                            });
                        }
                        await QuestService.incrementProgress(interaction.user.id, guildId, 'casino').catch(() => {});
                    } catch (err: unknown) {
                        if (err instanceof InsufficientFundsError) {
                            const msg = I18nService.translate(
                                'economy:INSUFFICIENT_FUNDS',
                                { lng: lang }
                            );
                            const errEmbed = EmbedUtils.error(
                                msg,
                                'Insufficient Funds',
                                interaction.user
                            );
                            await confirmation.update({
                                embeds: [errEmbed],
                                components: [],
                            });
                        } else {
                            throw err;
                        }
                    }
                } catch (e) {
                    const timeoutEmbed = EmbedUtils.warn(
                        lang === 'fr'
                            ? 'Le temps est écoulé.'
                            : 'You took too long to choose.',
                        'Timeout',
                        interaction.user
                    );
                    await interaction.editReply({
                        embeds: [timeoutEmbed],
                        components: [],
                    });
                }
            } else if (subcommand === 'rps') {
                // Early balance check to avoid rendering buttons if insufficient funds
                const balanceData = await EconomyService.getBalance(
                    interaction.user.id,
                    guildId
                );
                if (balanceData.balance < bet) {
                    throw new InsufficientFundsError();
                }
                const embed = EmbedUtils.base({
                    title: ' Rock Paper Scissors',
                    color: '#3498DB',
                    user: interaction.user,
                }).setDescription(
                    lang === 'fr'
                        ? `Choisissez votre action pour une mise de **${bet}** ! `
                        : `Choose your move for a bet of **${bet}** !`
                );
                const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                        .setCustomId('rps_rock')
                        .setLabel(lang === 'fr' ? 'Pierre ' : 'Rock ')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('rps_paper')
                        .setLabel(lang === 'fr' ? 'Papier ' : 'Paper ')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('rps_scissors')
                        .setLabel(lang === 'fr' ? 'Ciseaux ' : 'Scissors ')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('rps_cancel')
                        .setLabel(lang === 'fr' ? 'Annuler ❌' : 'Cancel ❌')
                        .setStyle(ButtonStyle.Danger)
                );
                const response = await interaction.reply({
                    embeds: [embed],
                    components: [row],
                });
                try {
                    const confirmation = await response.awaitMessageComponent({
                        filter: (i) => i.user.id === interaction.user.id,
                        time: 60000,
                        componentType: ComponentType.Button,
                    });
                    if (confirmation.customId === 'rps_cancel') {
                        const cancelEmbed = EmbedUtils.warn(
                            lang === 'fr'
                                ? 'Partie annulée.'
                                : 'Game cancelled.',
                            'Cancelled',
                            interaction.user
                        );
                        await confirmation.update({
                            embeds: [cancelEmbed],
                            components: [],
                        });
                        return;
                    }
                    const choice = confirmation.customId.replace('rps_', '') as
                        'rock' | 'paper' | 'scissors';
                    try {
                        const result = await CasinoService.rps(
                            interaction.user.id,
                            guildId,
                            bet,
                            choice
                        );
                        const botChoiceLoc = I18nService.translate(
                            `economy:CASINO_RPS_${result.botChoice!.toUpperCase()}`,
                            { lng: lang }
                        );
                        const userChoiceLoc = I18nService.translate(
                            `economy:CASINO_RPS_${choice.toUpperCase()}`,
                            { lng: lang }
                        );
                        let msg = '';
                        let finalEmbed;
                        if (result.state === 'win') {
                            msg = I18nService.translate(
                                'economy:CASINO_RPS_WIN',
                                {
                                    lng: lang,
                                    bot: botChoiceLoc,
                                    user: userChoiceLoc,
                                    won: result.returnAmount,
                                }
                            );
                            finalEmbed = EmbedUtils.success(
                                msg,
                                'You Won!',
                                interaction.user
                            );
                        } else if (result.state === 'lose') {
                            msg = I18nService.translate(
                                'economy:CASINO_RPS_LOSE',
                                {
                                    lng: lang,
                                    bot: botChoiceLoc,
                                    user: userChoiceLoc,
                                    bet,
                                }
                            );
                            finalEmbed = EmbedUtils.error(
                                msg,
                                'You Lost',
                                interaction.user
                            );
                        } else {
                            msg = I18nService.translate(
                                'economy:CASINO_RPS_TIE',
                                {
                                    lng: lang,
                                    bot: botChoiceLoc,
                                    user: userChoiceLoc,
                                }
                            );
                            finalEmbed = EmbedUtils.info(
                                msg,
                                "It's a Tie!",
                                interaction.user
                            );
                        }
                        await confirmation.update({
                            embeds: [finalEmbed],
                            components: [],
                        });
                        await QuestService.incrementProgress(interaction.user.id, guildId, 'casino').catch(() => {});
                    } catch (err: unknown) {
                        if (err instanceof InsufficientFundsError) {
                            const msg = I18nService.translate(
                                'economy:INSUFFICIENT_FUNDS',
                                { lng: lang }
                            );
                            const errEmbed = EmbedUtils.error(
                                msg,
                                'Insufficient Funds',
                                interaction.user
                            );
                            await confirmation.update({
                                embeds: [errEmbed],
                                components: [],
                            });
                        } else {
                            throw err;
                        }
                    }
                } catch (e) {
                    const timeoutEmbed = EmbedUtils.warn(
                        lang === 'fr'
                            ? 'Le temps est écoulé.'
                            : 'You took too long to choose.',
                        'Timeout',
                        interaction.user
                    );
                    await interaction.editReply({
                        embeds: [timeoutEmbed],
                        components: [],
                    });
                }
            } else if (subcommand === 'slots') {
                const result = await CasinoService.slots(
                    interaction.user.id,
                    guildId,
                    bet
                );
                const embed = EmbedUtils.base({
                    title: 'SLOTS',
                    color: result.win ? '#2ECC71' : '#E74C3C',
                    user: interaction.user,
                }).setDescription(`
**[ ${result.reels.join(' | ')} ]**
${
    result.win
        ? I18nService.translate('economy:CASINO_SLOTS_WIN', {
              lng: lang,
              won: result.winAmount,
          })
        : I18nService.translate('economy:CASINO_SLOTS_LOSE', { lng: lang, bet })
}
`);
                await interaction.reply({ embeds: [embed] });
                await QuestService.incrementProgress(interaction.user.id, guildId, 'casino').catch(() => {});
            }
        } catch (error: unknown) {
            if (error instanceof InsufficientFundsError) {
                const msg = I18nService.translate('economy:INSUFFICIENT_FUNDS', {
                    lng: lang,
                });
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
                const embed = EmbedUtils.error(msg, 'Error', interaction.user);
                await interaction.reply({
                    embeds: [embed],
                    flags: MessageFlags.Ephemeral,
                });
            }
        }
    }),
};

export default command;
