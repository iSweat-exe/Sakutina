import cron from 'node-cron';
import { db, userQuests, users } from '@sakutina/db';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger.js';
import { QuestService } from '../services/QuestService.js';

export class QuestResetJob {
    public static start() {
        // Daily reset at midnight UTC
        cron.schedule('0 0 * * *', async () => {
            try {
                // Delete all old daily quests
                await db.delete(userQuests).where(eq(userQuests.type, 'daily'));

                const allUsers = await db
                    .select({ id: users.discordId, guildId: users.guildId })
                    .from(users);

                const now = new Date();
                const expiresAt = new Date(now);
                expiresAt.setDate(expiresAt.getDate() + 1);

                const inserts: any[] = [];
                for (const user of allUsers) {
                    const selected = QuestService.pickQuests('daily');
                    for (const q of selected) {
                        inserts.push({
                            userId: user.id,
                            guildId: user.guildId,
                            questId: q.id,
                            target: q.target,
                            type: 'daily',
                            expiresAt,
                        });
                    }
                }

                if (inserts.length > 0) {
                    // Insert in chunks to avoid query limits
                    const chunkSize = 1000;
                    for (let i = 0; i < inserts.length; i += chunkSize) {
                        await db
                            .insert(userQuests)
                            .values(inserts.slice(i, i + chunkSize));
                    }
                }

                logger.info('[QuestResetJob] Daily quests reset successfully.');
            } catch (error) {
                logger.error(
                    '[QuestResetJob] Error resetting daily quests',
                    error
                );
            }
        });

        // Weekly reset on Monday at midnight UTC
        cron.schedule('0 0 * * 1', async () => {
            try {
                await db
                    .delete(userQuests)
                    .where(eq(userQuests.type, 'weekly'));

                const allUsers = await db
                    .select({ id: users.discordId, guildId: users.guildId })
                    .from(users);

                const now = new Date();
                const expiresAt = new Date(now);
                expiresAt.setDate(expiresAt.getDate() + 7);

                const inserts: any[] = [];
                for (const user of allUsers) {
                    const selected = QuestService.pickQuests('weekly');
                    for (const q of selected) {
                        inserts.push({
                            userId: user.id,
                            guildId: user.guildId,
                            questId: q.id,
                            target: q.target,
                            type: 'weekly',
                            expiresAt,
                        });
                    }
                }

                if (inserts.length > 0) {
                    const chunkSize = 1000;
                    for (let i = 0; i < inserts.length; i += chunkSize) {
                        await db
                            .insert(userQuests)
                            .values(inserts.slice(i, i + chunkSize));
                    }
                }

                logger.info(
                    '[QuestResetJob] Weekly quests reset successfully.'
                );
            } catch (error) {
                logger.error(
                    '[QuestResetJob] Error resetting weekly quests',
                    error
                );
            }
        });
    }
}
