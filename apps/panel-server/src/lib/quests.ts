import { incrementQuestProgress as sharedIncrementQuestProgress } from '@sakutina/db';

/**
 * Thin re-export of the shared `incrementQuestProgress` helper in
 * @sakutina/db (also used by apps/bot's QuestService). The panel has no
 * Discord client, so it doesn't pass an `onCompleted` callback — no DM to
 * send.
 */
export async function incrementQuestProgress(
    userId: string,
    guildId: string,
    actionType: string
) {
    return sharedIncrementQuestProgress(userId, guildId, actionType);
}
