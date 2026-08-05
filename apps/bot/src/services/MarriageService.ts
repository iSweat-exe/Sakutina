import { eq, or } from 'drizzle-orm';
import { db, marriages } from '@sakutina/db';
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
     * Marry two users. Re-checks both aren't already married inside the
     * transaction to keep the race window small.
     */
    public static async marry(user1Id: string, user2Id: string): Promise<void> {
        if (user1Id === user2Id) throw new MarriageError('SELF');

        await db.transaction(async (tx) => {
            const existing1 = await tx
                .select()
                .from(marriages)
                .where(
                    or(
                        eq(marriages.user1Id, user1Id),
                        eq(marriages.user2Id, user1Id)
                    )
                )
                .then((res) => res[0]);
            if (existing1) throw new MarriageError('ALREADY_MARRIED');

            const existing2 = await tx
                .select()
                .from(marriages)
                .where(
                    or(
                        eq(marriages.user1Id, user2Id),
                        eq(marriages.user2Id, user2Id)
                    )
                )
                .then((res) => res[0]);
            if (existing2) throw new MarriageError('TARGET_MARRIED');

            await tx.insert(marriages).values({ user1Id, user2Id });
        });
    }

    /**
     * Divorce a user from their partner. Returns the (former) partner's id.
     */
    public static async divorce(userId: string): Promise<string> {
        const marriage = await this.getMarriage(userId);
        if (!marriage) throw new MarriageError('NOT_MARRIED');

        await db.delete(marriages).where(eq(marriages.id, marriage.id));

        return marriage.user1Id === userId
            ? marriage.user2Id
            : marriage.user1Id;
    }
}


