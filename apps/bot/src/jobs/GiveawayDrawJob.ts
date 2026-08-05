import cron from 'node-cron';
import { logger } from '../utils/logger.js';
import { botClient } from '../bot.js';
import { GiveawayService } from '../services/GiveawayService.js';
import { GuildConfigService } from '../services/GuildConfigService.js';
import { I18nService } from '../services/I18nService.js';
import {
    buildGiveawayEndedEmbed,
    buildGiveawayJoinRow,
} from '../modules/social/embeds.js';

export class GiveawayDrawJob {
    public static start() {
        // Runs every minute
        cron.schedule('* * * * *', async () => {
            try {
                const due = await GiveawayService.getActiveDueForDraw();

                for (const giveaway of due) {
                    try {
                        const { winnerIds } = await GiveawayService.drawWinners(
                            giveaway.id
                        );
                        await GiveawayDrawJob.announce(giveaway.id, winnerIds);
                    } catch (err) {
                        logger.error(
                            `[GiveawayDrawJob] Failed to draw giveaway ${giveaway.id}`,
                            err
                        );
                    }
                }
            } catch (error) {
                logger.error(
                    '[GiveawayDrawJob] Error processing giveaways',
                    error
                );
            }
        });
    }

    /**
     * Edits the original giveaway message (disabled button, ended embed) and
     * announces the result in-channel. Shared by the auto-draw job and the
     * manual `/giveaway end`/`reroll` subcommands.
     */
    public static async announce(giveawayId: number, winnerIds: string[]) {
        const giveaway = await GiveawayService.getById(giveawayId);
        if (!giveaway) return;

        const lang = await GuildConfigService.getGuildLanguage(
            giveaway.guildId
        );
        const channel = await botClient.channels
            .fetch(giveaway.channelId)
            .catch(() => null);
        if (!channel || !channel.isTextBased() || !channel.isSendable()) return;

        if (giveaway.messageId) {
            const endedEmbed = buildGiveawayEndedEmbed(
                giveaway,
                winnerIds,
                lang
            );
            const disabledRow = buildGiveawayJoinRow(giveaway.id, lang, true);
            await channel.messages
                .edit(giveaway.messageId, {
                    embeds: [endedEmbed],
                    components: [disabledRow],
                })
                .catch(() => null);
        }

        const announceMsg =
            winnerIds.length > 0
                ? I18nService.translate('social:GIVEAWAY_ANNOUNCE', {
                      lng: lang,
                      winners: winnerIds.map((id) => `<@${id}>`).join(', '),
                      prize: giveaway.prize,
                  })
                : I18nService.translate('social:GIVEAWAY_ANNOUNCE_NO_WINNERS', {
                      lng: lang,
                      prize: giveaway.prize,
                  });

        await channel.send({ content: announceMsg }).catch(() => null);
    }
}
