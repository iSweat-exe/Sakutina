import { db, userQuests, users } from '@sakutina/db';
import { and, eq, sql } from 'drizzle-orm';
import { QUESTS_CONFIG } from '@sakutina/economy';
import { logTransaction } from './economy.js';

/**
 * Mirrors QuestService.incrementProgress + rewardQuest in apps/bot, minus the
 * Discord DM (panel-server has no bot client). Keeps quest progress in sync
 * for actions performed through the panel (work shifts, casino games).
 */
export async function incrementQuestProgress(
    userId: string,
    guildId: string,
    actionType: string
) {
    const active = await db
        .select()
        .from(userQuests)
        .where(
            and(
                eq(userQuests.userId, userId),
                eq(userQuests.guildId, guildId),
                eq(userQuests.completed, false)
            )
        );

    for (const quest of active) {
        if (!quest.questId.startsWith(actionType)) continue;

        const newProgress = quest.progress + 1;
        const isCompleted = newProgress >= quest.target;

        await db
            .update(userQuests)
            .set({ progress: newProgress, completed: isCompleted })
            .where(eq(userQuests.id, quest.id));

        if (isCompleted) {
            const configList = QUESTS_CONFIG[quest.type as 'daily' | 'weekly'];
            const config = configList.find((q) => q.id === quest.questId);
            if (config) {
                await db
                    .update(users)
                    .set({
                        balance: sql`${users.balance} + ${config.reward}`,
                        updatedAt: new Date(),
                    })
                    .where(
                        and(
                            eq(users.discordId, userId),
                            eq(users.guildId, guildId)
                        )
                    );
                await logTransaction(
                    userId,
                    guildId,
                    'quest_reward',
                    config.reward,
                    'Quest completed'
                );
            }
        }
    }
}
