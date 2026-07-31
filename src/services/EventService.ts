import {
    Message,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    ButtonInteraction,
} from 'discord.js';
import { db } from '../repositories/db.js';
import { users } from '../repositories/schema.js';
import { eq, and } from 'drizzle-orm';
import { EconomyService } from './EconomyService.js';
import { EmbedUtils } from '../utils/EmbedUtils.js';
import { I18nService } from './I18nService.js';
import { GuildConfigService } from './GuildConfigService.js';
import { logger } from '../utils/logger.js';

export class EventService {
    /**
     * 5% chance to trigger an event
     */
    public static async maybeTriggerEvent(message: Message) {
        if (Math.random() > 0.05) return;

        const lang = message.guildId
            ? await GuildConfigService.getGuildLanguage(message.guildId)
            : 'en';
        const guildId = message.guildId ?? 'dm';

        const eventType = Math.floor(Math.random() * 3); // 0: coins, 1: xp bonus, 2: job bonus

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId('random_event_claim')
                .setLabel(
                    I18nService.translate('common:EVENT_CLAIM_BUTTON', {
                        lng: lang,
                    })
                )
                .setStyle(ButtonStyle.Success)
                .setEmoji('🎁')
        );

        let desc = I18nService.translate('common:EVENT_SPAWN_DESC', {
            lng: lang,
        });
        const embed = EmbedUtils.base({
            title: I18nService.translate('common:EVENT_TITLE', { lng: lang }),
            description: desc,
            color: '#FFD700',
        });

        if (!message.channel.isSendable()) return;
        const eventMsg = await message.channel.send({
            embeds: [embed],
            components: [row],
        });

        try {
            const collector = eventMsg.createMessageComponentCollector({
                filter: (i: ButtonInteraction) => !i.user.bot,
                max: 1,
                time: 60000,
                componentType: ComponentType.Button,
            });

            collector.on('collect', async (i: ButtonInteraction) => {
                try {
                    await this.handleClaim(
                        i,
                        eventType,
                        guildId,
                        lang,
                        eventMsg
                    );
                } catch (error) {
                    logger.error(
                        '[EventService] Failed to process event claim',
                        error
                    );
                }
            });

            collector.on('end', (collected: any) => {
                if (collected.size === 0) {
                    const timeoutEmbed = EmbedUtils.base({
                        title: I18nService.translate(
                            'common:EVENT_EXPIRED_TITLE',
                            { lng: lang }
                        ),
                        description: I18nService.translate(
                            'common:EVENT_EXPIRED_DESC',
                            { lng: lang }
                        ),
                        color: '#FF0000',
                    });
                    eventMsg
                        .edit({ embeds: [timeoutEmbed], components: [] })
                        .catch(() => {});
                }
            });
        } catch (err) {
            logger.error(
                '[EventService] Failed to set up event collector',
                err
            );
        }
    }

    private static async handleClaim(
        i: ButtonInteraction,
        eventType: number,
        guildId: string,
        lang: string,
        eventMsg: Message
    ) {
        await i.deferUpdate();
        let rewardMsg = '';

        if (eventType === 0) {
            const amount = Math.floor(Math.random() * 100) + 50; // 50-150 coins
            await EconomyService.addBalance(
                i.user.id,
                guildId,
                amount,
                'Event reward',
                'event_reward'
            );
            rewardMsg = I18nService.translate('common:EVENT_REWARD_COINS', {
                lng: lang,
                user: i.user.username,
                amount,
            });
        } else if (eventType === 1) {
            const until = new Date();
            until.setHours(until.getHours() + 1); // 1 hour 2x XP
            await EconomyService.ensureUser(i.user.id, guildId);
            await db
                .update(users)
                .set({ bonusXpUntil: until })
                .where(
                    and(
                        eq(users.discordId, i.user.id),
                        eq(users.guildId, guildId)
                    )
                );
            rewardMsg = I18nService.translate('common:EVENT_REWARD_XP', {
                lng: lang,
                user: i.user.username,
            });
        } else {
            const until = new Date();
            until.setHours(until.getHours() + 1); // 1 hour 2x Money (Jobs)
            await EconomyService.ensureUser(i.user.id, guildId);
            await db
                .update(users)
                .set({ bonusMoneyUntil: until })
                .where(
                    and(
                        eq(users.discordId, i.user.id),
                        eq(users.guildId, guildId)
                    )
                );
            rewardMsg = I18nService.translate('common:EVENT_REWARD_MONEY', {
                lng: lang,
                user: i.user.username,
            });
        }

        const successEmbed = EmbedUtils.base({
            title: I18nService.translate('common:EVENT_CLAIMED_TITLE', {
                lng: lang,
            }),
            description: rewardMsg,
            color: '#00FF00',
        });

        await eventMsg.edit({ embeds: [successEmbed], components: [] });
    }
}
