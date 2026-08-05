import cron from 'node-cron';
import { db, reminders } from '@sakutina/db';
import { lte, eq } from 'drizzle-orm';
import { logger } from '../utils/logger.js';
import { botClient } from '../bot.js';
import { userMention } from 'discord.js';
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
                        const channel = await botClient.channels
                            .fetch(reminder.channelId)
                            .catch(() => null);
                        if (channel && channel.isSendable()) {
                            const guildId = channel.isDMBased()
                                ? null
                                : channel.guildId;
                            const lang =
                                await GuildConfigService.getGuildLanguage(
                                    guildId
                                );
                            const content = I18nService.translate(
                                'common:REMINDER_PING',
                                {
                                    lng: lang,
                                    user: userMention(reminder.userId),
                                    message: reminder.message,
                                }
                            );
                            await channel.send({ content });
                        }
                    } catch (err) {
                        logger.error(
                            `[ReminderJob] Failed to send reminder ${reminder.id}`,
                            err
                        );
                    }

                    if (reminder.repeatMinutes) {
                        // Reschedule from now (not from the original remindAt)
                        // to avoid catch-up spam if the bot was offline.
                        const nextRemindAt = new Date(
                            now.getTime() + reminder.repeatMinutes * 60000
                        );
                        await db
                            .update(reminders)
                            .set({ remindAt: nextRemindAt })
                            .where(eq(reminders.id, reminder.id));
                    } else {
                        await db
                            .delete(reminders)
                            .where(eq(reminders.id, reminder.id));
                    }
                }
            } catch (error) {
                logger.error('[ReminderJob] Error processing reminders', error);
            }
        });
    }
}


