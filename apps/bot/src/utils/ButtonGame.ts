import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChatInputCommandInteraction,
    ComponentType,
    type ColorResolvable,
    type EmbedBuilder,
} from 'discord.js';
import { I18nService } from '@/services/I18nService.js';
import { EconomyService } from '@/services/EconomyService.js';
import { EmbedUtils } from './EmbedUtils.js';
import { InsufficientFundsError } from './errors.js';
import { QuestService } from '@/services/QuestService.js';

export interface ButtonGameChoice {
    customId: string;
    labelFr: string;
    labelEn: string;
    style: ButtonStyle;
}

export interface RunButtonGameOptions<TChoice extends string, TResult> {
    interaction: ChatInputCommandInteraction;
    lang: string;
    guildId: string;
    bet: number;
    title: string;
    color: ColorResolvable;
    description: string;
    choices: ButtonGameChoice[];
    cancelCustomId: string;
    parseChoice: (customId: string) => TChoice;
    play: (choice: TChoice) => Promise<TResult>;
    buildResultEmbed: (result: TResult, choice: TChoice) => EmbedBuilder;
}

/**
 * Shared "build embed + buttons -> reply -> awaitMessageComponent -> handle
 * cancel/choice/insufficient funds/timeout" flow used by every button-driven
 * casino game (coinflip, rps, ...). Errors other than InsufficientFundsError
 * thrown by `play` propagate to the caller so its own top-level catch (which
 * knows about BetTooLargeError and generic errors) can handle them.
 */
export async function runButtonGame<TChoice extends string, TResult>(
    options: RunButtonGameOptions<TChoice, TResult>
): Promise<void> {
    const {
        interaction,
        lang,
        guildId,
        bet,
        title,
        color,
        description,
        choices,
        cancelCustomId,
        parseChoice,
        play,
        buildResultEmbed,
    } = options;

    const balanceData = await EconomyService.getBalance(
        interaction.user.id,
        guildId
    );
    if (balanceData.balance < bet) {
        throw new InsufficientFundsError();
    }

    const embed = EmbedUtils.base({
        title,
        color,
        user: interaction.user,
    }).setDescription(description);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        ...choices.map((choice) =>
            new ButtonBuilder()
                .setCustomId(choice.customId)
                .setLabel(lang === 'fr' ? choice.labelFr : choice.labelEn)
                .setStyle(choice.style)
        ),
        new ButtonBuilder()
            .setCustomId(cancelCustomId)
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

        if (confirmation.customId === cancelCustomId) {
            const cancelEmbed = EmbedUtils.warn(
                lang === 'fr' ? 'Partie annulée.' : 'Game cancelled.',
                'Cancelled',
                interaction.user
            );
            await confirmation.update({
                embeds: [cancelEmbed],
                components: [],
            });
            return;
        }

        const choice = parseChoice(confirmation.customId);
        try {
            const result = await play(choice);
            const finalEmbed = buildResultEmbed(result, choice);
            await confirmation.update({ embeds: [finalEmbed], components: [] });
            await QuestService.incrementProgress(
                interaction.user.id,
                guildId,
                'casino'
            ).catch(() => {});
        } catch (err: unknown) {
            if (err instanceof InsufficientFundsError) {
                const msg = I18nService.translate(
                    'economy:INSUFFICIENT_FUNDS',
                    {
                        lng: lang,
                    }
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
        await interaction.editReply({ embeds: [timeoutEmbed], components: [] });
    }
}
