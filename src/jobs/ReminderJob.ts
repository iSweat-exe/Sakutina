import cron from 'node-cron';
import { db } from '../repositories/db.js';
import { reminders } from '../repositories/schema.js';
import { lte, eq } from 'drizzle-orm';
import { logger } from '../utils/logger.js';
import { botClient } from '../bot.js';
import { TextChannel, userMention } from 'discord.js';
import { I18nService } from '../services/I18nService.js';
import { GuildConfigService } from '../services/GuildConfigService.js';

export class ReminderJob {
    public static start() {
        // Runs every minute
        cron.schedule('* * * * *', async () => {
            try {
                const now = new Date();
                const dueReminders = await db
                    .select()
                    .from(reminders)
                    .where(lte(reminders.remindAt, now));

                for (const reminder of dueReminders) {
                    try {
                        const channel = await botClient.channels.fetch(reminder.channelId).catch(() => null);
                        if (channel && channel.isSendable()) {
                            const guildId = channel.isDMBased() ? null : (channel as any).guildId;
                            const lang = guildId ? await GuildConfigService.getGuildLanguage(guildId) : 'fr';
                            const content = I18nService.translate('common:REMINDER_PING', {
                                lng: lang,
                                user: userMention(reminder.userId),
                                message: reminder.message
                            });
                            await channel.send({ content });
                        }
                    } catch (err) {
                        logger.error(`[ReminderJob] Failed to send reminder ${reminder.id}`, err);
                    }

                    // Delete reminder after sending (or failing to send if channel is inaccessible)
                    await db.delete(reminders).where(eq(reminders.id, reminder.id));
                }
            } catch (error) {
                logger.error('[ReminderJob] Error processing reminders', error);
            }
        });
    }
}
