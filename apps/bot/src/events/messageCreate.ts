import { Events, GuildMember, Message } from 'discord.js';
import { GuildConfigService } from '../services/GuildConfigService.js';
import { EventService } from '../services/EventService.js';
import { AutoModService } from '../services/AutoModService.js';
import { ModerationService } from '../services/ModerationService.js';
import { I18nService } from '../services/I18nService.js';
import { ActivityService } from '../services/ActivityService.js';
import { logger } from '../utils/logger.js';

export default {
    name: Events.MessageCreate,
    async execute(message: Message) {
        if (message.author.bot || !message.guildId) return;

        ActivityService.recordMessage(message.guildId, message.channelId).catch(
            (err) => {
                logger.error(
                    `[MessageCreate] Failed to record channel activity for ${message.channelId}`,
                    err
                );
            }
        );

        try {
            const config = await GuildConfigService.getGuildSettings(
                message.guildId
            );

            const eventChannels = await GuildConfigService.getEventChannels(
                message.guildId
            );
            if (eventChannels.includes(message.channelId)) {
                await EventService.maybeTriggerEvent(message);
            }

            if (config.autoModEnabled && message.guild) {
                const isSpam = AutoModService.checkSpam(
                    message.guildId,
                    message.author.id
                );
                const hasLink = AutoModService.containsLink(message.content);

                if (isSpam || hasLink) {
                    await message.delete().catch(() => {});

                    const member = message.member as GuildMember | null;
                    if (member) {
                        const lang = await GuildConfigService.getGuildLanguage(
                            message.guildId
                        );
                        const reason = I18nService.translate(
                            isSpam
                                ? 'mod:AUTOMOD_REASON_SPAM'
                                : 'mod:AUTOMOD_REASON_LINK',
                            { lng: lang }
                        );
                        await ModerationService.warn(
                            message.guild,
                            member,
                            message.client.user,
                            reason
                        ).catch((err) => {
                            logger.error(
                                `[MessageCreate] Auto-mod failed to warn ${member.id} in ${message.guildId}`,
                                err
                            );
                        });

                        if (message.channel.isSendable()) {
                            const notice = I18nService.translate(
                                'mod:AUTOMOD_NOTICE',
                                { lng: lang, user: message.author.toString() }
                            );
                            message.channel
                                .send({ content: notice })
                                .then((sent) =>
                                    setTimeout(
                                        () => sent.delete().catch(() => {}),
                                        5000
                                    )
                                )
                                .catch(() => {});
                        }
                    }
                }
            }
        } catch (error) {
            logger.error('[MessageCreate] Error handling message', error);
        }
    },
};
