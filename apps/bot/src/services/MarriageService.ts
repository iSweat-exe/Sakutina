import { eq, inArray, or } from 'drizzle-orm';
import { db, marriages, marriedUsers } from '@sakutina/db';
import { MarriageError } from '../utils/errors.js';

export class MarriageService {
    /**
     * Get the marriage row involving a user, if any. Marriages are global â€”
     * not scoped to a guild â€” so this works the same in DMs and servers.
     */
    public static async getMarriage(userId: string) {
        const marriage = await db
            .select()
            .from(marriages)
            .where(
                or(eq(marriages.user1Id, userId), eq(marriages.user2Id, userId))
            )
            .then((res) => res[0]);
        return marriage ?? null;
    }

    public static async isMarried(userId: string): Promise<boolean> {
        return (await this.getMarriage(userId)) !== null;
    }

    /**
     * Marry two users. The atomicity comes from `married_users.user_id`
     * being unique: both spouses are inserted there inside the transaction,
     * so a concurrent `marry` for either user hits a unique violation and
     * the whole transaction rolls back, instead of the old select-then-insert
     * check that two concurrent transactions could both pass under
     * `READ COMMITTED`.
     */
    public static async marry(user1Id: string, user2Id: string): Promise<void> {
        if (user1Id === user2Id) throw new MarriageError('SELF');

        await db.transaction(async (tx) => {
            const marriage = await tx
                .insert(marriages)
                .values({ user1Id, user2Id })
                .returning()
                .then((res) => res[0]);
            if (!marriage) throw new Error('Failed to insert marriage');

            const locked = await tx
                .insert(marriedUsers)
                .values([
                    { userId: user1Id, marriageId: marriage.id },
                    { userId: user2Id, marriageId: marriage.id },
                ])
                .onConflictDoNothing()
                .returning({ userId: marriedUsers.userId });
            const lockedIds = new Set(locked.map((l) => l.userId));

            if (!lockedIds.has(user1Id))
                throw new MarriageError('ALREADY_MARRIED');
            if (!lockedIds.has(user2Id))
                throw new MarriageError('TARGET_MARRIED');
        });
    }

    /**
     * Divorce a user from their partner. Returns the (former) partner's id.
     */
    public static async divorce(userId: string): Promise<string> {
        const marriage = await this.getMarriage(userId);
        if (!marriage) throw new MarriageError('NOT_MARRIED');

        await db.transaction(async (tx) => {
            await tx.delete(marriages).where(eq(marriages.id, marriage.id));
            await tx
                .delete(marriedUsers)
                .where(
                    inArray(marriedUsers.userId, [
                        marriage.user1Id,
                        marriage.user2Id,
                    ])
                );
        });

        return marriage.user1Id === userId
            ? marriage.user2Id
            : marriage.user1Id;
    }
}
