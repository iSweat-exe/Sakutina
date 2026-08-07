import {
    db,
    userQuests,
    incrementQuestProgress,
    type QuestCompletionEvent,
} from '@sakutina/db';
import { eq, and } from 'drizzle-orm';
import { QUESTS_CONFIG } from '@sakutina/economy';
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
     * The actual DB writes (atomic progress/completion + reward grant) live
     * in the shared `incrementQuestProgress` helper in @sakutina/db, used by
     * both this service and apps/panel-server's lib/quests.ts. This just
     * layers the Discord DM notification on top via `onCompleted`.
     */
    public static async incrementProgress(
        userId: string,
        guildId: string,
        actionType: string
    ) {
        await incrementQuestProgress(userId, guildId, actionType, (event) =>
            this.notifyQuestCompleted(userId, guildId, event)
        );
    }

    private static async notifyQuestCompleted(
        userId: string,
        guildId: string,
        event: QuestCompletionEvent
    ) {
        try {
            const lang = await GuildConfigService.getGuildLanguage(guildId);
            const user = await botClient.users.fetch(userId);
            if (user) {
                const desc = I18nService.translate(
                    `common:QUEST_DESC_${event.questId}`,
                    { lng: lang }
                );
                const typeLabel = I18nService.translate(
                    `economy:QUESTS_${event.type.toUpperCase()}_LABEL`,
                    { lng: lang }
                );
                const msg = I18nService.translate('common:QUEST_COMPLETED_DM', {
                    lng: lang,
                    type: typeLabel,
                    desc,
                    reward: event.reward,
                });
                await user.send(msg).catch(() => {});
            }
        } catch (err) {}
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
