import { db, userQuests } from '@sakutina/db';
import { eq, and } from 'drizzle-orm';
import { QUESTS_CONFIG } from '@sakutina/economy';
import { EconomyService } from './EconomyService.js';
import { botClient } from '../bot.js';
import { I18nService } from './I18nService.js';
import { GuildConfigService } from './GuildConfigService.js';

export { QUESTS_CONFIG };

export class QuestService {
    /**
     * Randomly select 2 quests from the given pool ('daily' or 'weekly').
     */
    public static pickQuests(type: 'daily' | 'weekly') {
        const pool = QUESTS_CONFIG[type];
        const shuffled = [...pool].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, 2);
    }

    /**
     * Assign 2 random quests of the given type to a user immediately
     * (used for brand-new users, who would otherwise wait for the next
     * scheduled reset in QuestResetJob).
     */
    public static async assignQuests(
        userId: string,
        guildId: string,
        type: 'daily' | 'weekly'
    ) {
        const selected = this.pickQuests(type);

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + (type === 'daily' ? 1 : 7));

        const inserts = selected.map((q) => ({
            userId,
            guildId,
            questId: q.id,
            target: q.target,
            type,
            expiresAt,
        }));

        if (inserts.length > 0) {
            await db.insert(userQuests).values(inserts);
        }
        return inserts;
    }

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
