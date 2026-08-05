import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    userMention,
} from 'discord.js';
import { I18nService } from '@/services/I18nService.js';
import { EmbedUtils } from '@/utils/EmbedUtils.js';
import type { Giveaway } from '@sakutina/db';

export function buildGiveawayEmbed(
    giveaway: Giveaway,
    lang: string
): EmbedBuilder {
    const roleLine = giveaway.requiredRoleId
        ? I18nService.translate('social:GIVEAWAY_EMBED_ROLE_LINE', {
              lng: lang,
              role: `<@&${giveaway.requiredRoleId}>`,
          })
        : '';
    const description = I18nService.translate('social:GIVEAWAY_EMBED_DESC', {
        lng: lang,
        prize: giveaway.prize,
        host: userMention(giveaway.hostId),
        winnerCount: giveaway.winnerCount,
        timestamp: Math.floor(giveaway.endsAt.getTime() / 1000),
        roleLine,
    });
    return EmbedUtils.base({
        title: I18nService.translate('social:GIVEAWAY_EMBED_TITLE', {
            lng: lang,
        }),
        description,
        color: '#F1C40F',
    });
}

export function buildGiveawayJoinRow(
    giveawayId: number,
    lang: string,
    disabled = false
): ActionRowBuilder<ButtonBuilder> {
    const button = new ButtonBuilder()
        .setCustomId(`giveaway:join:${giveawayId}`)
        .setLabel(
            I18nService.translate('social:GIVEAWAY_JOIN_BUTTON', { lng: lang })
        )
        .setEmoji('🎉')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled);
    return new ActionRowBuilder<ButtonBuilder>().addComponents(button);
}

export function buildGiveawayEndedEmbed(
    giveaway: Giveaway,
    winnerIds: string[],
    lang: string
): EmbedBuilder {
    const description =
        winnerIds.length > 0
            ? I18nService.translate('social:GIVEAWAY_ENDED_DESC_WINNERS', {
                  lng: lang,
                  prize: giveaway.prize,
                  winners: winnerIds.map((id) => userMention(id)).join(', '),
              })
            : I18nService.translate('social:GIVEAWAY_ENDED_DESC_NO_WINNERS', {
                  lng: lang,
                  prize: giveaway.prize,
              });
    return EmbedUtils.base({
        title: I18nService.translate('social:GIVEAWAY_ENDED_TITLE', {
            lng: lang,
        }),
        description,
        color: '#95A5A6',
    });
}
