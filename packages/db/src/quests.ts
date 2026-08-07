import { and, eq, sql } from 'drizzle-orm';
import { QUESTS_CONFIG } from '@sakutina/economy';
import { db } from './client.js';
import { userQuests, users, transactions } from './schema.js';

export interface QuestCompletionEvent {
    userId: string;
    guildId: string;
    questId: string;
    type: 'daily' | 'weekly';
    reward: number;
}

/**
 * Single implementation of quest-progress incrementing, shared by
 * apps/bot's QuestService and apps/panel-server's lib/quests.ts (which used
 * to each carry their own copy). Progress and completion are both computed
 * in SQL (`progress + 1`, `progress + 1 >= target`) inside one `UPDATE`
 * guarded by `completed = false`, instead of reading `progress` in JS and
 * writing it back — so concurrent triggers of the same quest (e.g. two fast
 * casino bets both counting toward "play 5 times") can't lose an
 * increment, and the reward can't be granted twice for the same quest.
 *
 * `onCompleted` lets each app layer its own side effects (a Discord DM in
 * the bot, nothing in the panel) on top of the shared DB writes.
 */
export async function incrementQuestProgress(
    userId: string,
    guildId: string,
    actionType: string,
    onCompleted?: (event: QuestCompletionEvent) => Promise<void> | void
): Promise<QuestCompletionEvent[]> {
    const completions: QuestCompletionEvent[] = [];

    await db.transaction(async (tx) => {
        const active = await tx
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

            const updated = await tx
                .update(userQuests)
                .set({
                    progress: sql`${userQuests.progress} + 1`,
                    completed: sql`(${userQuests.progress} + 1) >= ${userQuests.target}`,
                })
                .where(
                    and(
                        eq(userQuests.id, quest.id),
                        eq(userQuests.completed, false)
                    )
                )
                .returning()
                .then((res) => res[0]);
            // 0 rows affected means another concurrent increment already
            // completed (or is mid-flight on) this quest — nothing to do.
            if (!updated || !updated.completed) continue;

            const type = quest.type as 'daily' | 'weekly';
            const config = QUESTS_CONFIG[type].find(
                (q) => q.id === quest.questId
            );
            if (!config) continue;

            await tx
                .update(users)
                .set({
                    balance: sql`${users.balance} + ${config.reward}`,
                    updatedAt: new Date(),
                })
                .where(
                    and(eq(users.discordId, userId), eq(users.guildId, guildId))
                );
            await tx.insert(transactions).values({
                userId,
                guildId,
                type: 'quest_reward',
                amount: config.reward,
                details: 'Quest completed',
            });

            completions.push({
                userId,
                guildId,
                questId: quest.questId,
                type,
                reward: config.reward,
            });
        }
    });

    for (const event of completions) {
        await onCompleted?.(event);
    }

    return completions;
}
