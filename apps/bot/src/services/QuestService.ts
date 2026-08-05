import { db, userQuests } from '@sakutina/db';
import { eq, and } from 'drizzle-orm';
import { EconomyService } from './EconomyService.js';
import { botClient } from '../bot.js';
import { I18nService } from './I18nService.js';
import { GuildConfigService } from './GuildConfigService.js';

export const QUESTS_CONFIG = {
    daily: [
        { id: 'work_3', target: 3, reward: 500, desc: 'Work 3 times' },
        { id: 'casino_5', target: 5, reward: 300, desc: 'Play casino 5 times' },
    ],
    weekly: [
        { id: 'work_15', target: 15, reward: 2000, desc: 'Work 15 times' },
        {
            id: 'casino_25',
            target: 25,
            reward: 1500,
            desc: 'Play casino 25 times',
        },
    ],
};

export class QuestService {
    /**
     * Increment progress for a specific quest type (e.g., 'work', 'casino').
     */
    public static async incrementProgress(
        userId: string,
        guildId: string,
        actionType: string
    ) {
        const userAllQuests = await db
            .select()
            .from(userQuests)
            .where(
                and(
                    eq(userQuests.userId, userId),
                    eq(userQuests.guildId, guildId),
                    eq(userQuests.completed, false)
                )
            );

        for (const quest of userAllQuests) {
            if (quest.questId.startsWith(actionType)) {
                const newProgress = quest.progress + 1;
                const isCompleted = newProgress >= quest.target;

                await db
                    .update(userQuests)
                    .set({
                        progress: newProgress,
                        completed: isCompleted,
                    })
                    .where(eq(userQuests.id, quest.id));

                if (isCompleted) {
                    await this.rewardQuest(
                        userId,
                        guildId,
                        quest.questId,
                        quest.type as 'daily' | 'weekly'
                    );
                }
            }
        }
    }

    private static async rewardQuest(
        userId: string,
        guildId: string,
        questId: string,
        type: 'daily' | 'weekly'
    ) {
        const configList = QUESTS_CONFIG[type];
        const config = configList.find((q) => q.id === questId);
        if (config) {
            await EconomyService.addBalance(
                userId,
                guildId,
                config.reward,
                'Quest completed',
                'quest_reward'
            );
            try {
                const lang = await GuildConfigService.getGuildLanguage(guildId);
                const user = await botClient.users.fetch(userId);
                if (user) {
                    const desc = I18nService.translate(
                        `common:QUEST_DESC_${config.id}`,
                        { lng: lang }
                    );
                    const typeLabel = I18nService.translate(
                        `economy:QUESTS_${type.toUpperCase()}_LABEL`,
                        { lng: lang }
                    );
                    const msg = I18nService.translate(
                        'common:QUEST_COMPLETED_DM',
                        {
                            lng: lang,
                            type: typeLabel,
                            desc,
                            reward: config.reward,
                        }
                    );
                    await user.send(msg).catch(() => {});
                }
            } catch (err) {}
        }
    }

    /**
     * Get a user's active quests
     */
    public static async getUserQuests(userId: string, guildId: string) {
        return await db
            .select()
            .from(userQuests)
            .where(
                and(
                    eq(userQuests.userId, userId),
                    eq(userQuests.guildId, guildId)
                )
            );
    }
}
