import { createCommandHandler } from '@/utils/index.js';
import {
    ChatInputCommandInteraction,
    MessageFlags,
    SlashCommandBuilder,
    ButtonStyle,
} from 'discord.js';
import { MAX_BET } from '@sakutina/games';
import type { Command } from '@/types/Command.js';
import { I18nService } from '@/services/I18nService.js';
import { CasinoService } from '@/services/CasinoService.js';
import { EmbedUtils } from '@/utils/EmbedUtils.js';
import { BetTooLargeError, InsufficientFundsError } from '@/utils/errors.js';
import { QuestService } from '@/services/QuestService.js';
import { runButtonGame } from '@/utils/ButtonGame.js';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('casino')
        .setDescription('Play casino minigames')
        .setDescriptionLocalizations({ fr: 'Jouer aux mini-jeux du casino' })
        .addSubcommand((subcommand) =>
            subcommand
                .setName('doubleornothing')
                .setDescription('50% chance to double your bet')
                .setDescriptionLocalizations({
                    fr: '50% de chance de doubler votre mise',
                })
                .addIntegerOption((option) =>
                    option
                        .setName('bet')
                        .setDescription('Amount to bet')
                        .setDescriptionLocalizations({ fr: 'Montant à miser' })
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(MAX_BET)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('coinflip')
                .setDescription('Bet on heads or tails')
                .setDescriptionLocalizations({ fr: 'Parier sur pile ou face' })
                .addIntegerOption((option) =>
                    option
                        .setName('bet')
                        .setDescription('Amount to bet')
                        .setDescriptionLocalizations({ fr: 'Montant à miser' })
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(MAX_BET)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('rps')
                .setDescription('Rock Paper Scissors against the bot')
                .setDescriptionLocalizations({
                    fr: 'Pierre Papier Ciseaux contre le bot',
                })
                .addIntegerOption((option) =>
                    option
                        .setName('bet')
                        .setDescription('Amount to bet')
                        .setDescriptionLocalizations({ fr: 'Montant à miser' })
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(MAX_BET)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('slots')
                .setDescription('Play the slot machine')
                .setDescriptionLocalizations({
                    fr: 'Jouer à la machine à sous',
                })
                .addIntegerOption((option) =>
                    option
                        .setName('bet')
                        .setDescription('Amount to bet')
                        .setDescriptionLocalizations({ fr: 'Montant à miser' })
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(MAX_BET)
                )
        ),
    execute: createCommandHandler(
        async (interaction: ChatInputCommandInteraction, lang: string) => {
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
                        const msg = I18nService.translate(
                            'economy:CASINO_DON_WIN',
                            {
                                lng: lang,
                                bet,
                                won: result.amount,
                            }
                        );
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
                    await QuestService.incrementProgress(
                        interaction.user.id,
                        guildId,
                        'casino'
                    ).catch(() => {});
                } else if (subcommand === 'coinflip') {
                    await runButtonGame<
                        'heads' | 'tails',
                        Awaited<ReturnType<typeof CasinoService.coinflip>>
                    >({
                        interaction,
                        lang,
                        guildId,
                        bet,
                        title: ' Coinflip',
                        color: '#F1C40F',
                        description:
                            lang === 'fr'
                                ? `Pile ou Face ? Mise : **${bet}**`
                                : `Heads or Tails? Bet: **${bet}**`,
                        cancelCustomId: 'coin_cancel',
                        choices: [
                            {
                                customId: 'coin_heads',
                                labelFr: 'Face',
                                labelEn: 'Heads',
                                style: ButtonStyle.Primary,
                            },
                            {
                                customId: 'coin_tails',
                                labelFr: 'Pile',
                                labelEn: 'Tails',
                                style: ButtonStyle.Primary,
                            },
                        ],
                        parseChoice: (customId) =>
                            customId.replace('coin_', '') as 'heads' | 'tails',
                        play: (choice) =>
                            CasinoService.coinflip(
                                interaction.user.id,
                                guildId,
                                bet,
                                choice
                            ),
                        buildResultEmbed: (result) => {
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
                                return EmbedUtils.success(
                                    msg,
                                    'You Won!',
                                    interaction.user
                                );
                            }
                            const msg = I18nService.translate(
                                'economy:CASINO_COIN_LOSE',
                                { lng: lang, bet, result: localizedResult }
                            );
                            return EmbedUtils.error(
                                msg,
                                'You Lost',
                                interaction.user
                            );
                        },
                    });
                } else if (subcommand === 'rps') {
                    await runButtonGame<
                        'rock' | 'paper' | 'scissors',
                        Awaited<ReturnType<typeof CasinoService.rps>>
                    >({
                        interaction,
                        lang,
                        guildId,
                        bet,
                        title: ' Rock Paper Scissors',
                        color: '#3498DB',
                        description:
                            lang === 'fr'
                                ? `Choisissez votre action pour une mise de **${bet}** ! `
                                : `Choose your move for a bet of **${bet}** !`,
                        cancelCustomId: 'rps_cancel',
                        choices: [
                            {
                                customId: 'rps_rock',
                                labelFr: 'Pierre ',
                                labelEn: 'Rock ',
                                style: ButtonStyle.Primary,
                            },
                            {
                                customId: 'rps_paper',
                                labelFr: 'Papier ',
                                labelEn: 'Paper ',
                                style: ButtonStyle.Primary,
                            },
                            {
                                customId: 'rps_scissors',
                                labelFr: 'Ciseaux ',
                                labelEn: 'Scissors ',
                                style: ButtonStyle.Primary,
                            },
                        ],
                        parseChoice: (customId) =>
                            customId.replace('rps_', '') as
                                'rock' | 'paper' | 'scissors',
                        play: (choice) =>
                            CasinoService.rps(
                                interaction.user.id,
                                guildId,
                                bet,
                                choice
                            ),
                        buildResultEmbed: (result, choice) => {
                            const botChoiceLoc = I18nService.translate(
                                `economy:CASINO_RPS_${result.botChoice!.toUpperCase()}`,
                                { lng: lang }
                            );
                            const userChoiceLoc = I18nService.translate(
                                `economy:CASINO_RPS_${choice.toUpperCase()}`,
                                { lng: lang }
                            );
                            if (result.state === 'win') {
                                const msg = I18nService.translate(
                                    'economy:CASINO_RPS_WIN',
                                    {
                                        lng: lang,
                                        bot: botChoiceLoc,
                                        user: userChoiceLoc,
                                        won: result.returnAmount,
                                    }
                                );
                                return EmbedUtils.success(
                                    msg,
                                    'You Won!',
                                    interaction.user
                                );
                            }
                            if (result.state === 'lose') {
                                const msg = I18nService.translate(
                                    'economy:CASINO_RPS_LOSE',
                                    {
                                        lng: lang,
                                        bot: botChoiceLoc,
                                        user: userChoiceLoc,
                                        bet,
                                    }
                                );
                                return EmbedUtils.error(
                                    msg,
                                    'You Lost',
                                    interaction.user
                                );
                            }
                            const msg = I18nService.translate(
                                'economy:CASINO_RPS_TIE',
                                {
                                    lng: lang,
                                    bot: botChoiceLoc,
                                    user: userChoiceLoc,
                                }
                            );
                            return EmbedUtils.info(
                                msg,
                                "It's a Tie!",
                                interaction.user
                            );
                        },
                    });
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
                    await QuestService.incrementProgress(
                        interaction.user.id,
                        guildId,
                        'casino'
                    ).catch(() => {});
                }
            } catch (error: unknown) {
                if (error instanceof InsufficientFundsError) {
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
                } else if (error instanceof BetTooLargeError) {
                    const msg = I18nService.translate(
                        'economy:CASINO_BET_TOO_LARGE',
                        { lng: lang, max: error.maxBet }
                    );
                    const embed = EmbedUtils.error(
                        msg,
                        'Bet Too Large',
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
