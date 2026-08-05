import { and, eq, lte } from 'drizzle-orm';
import { db, giveaways, giveawayEntries, giveawayWinners } from '@sakutina/db';
import { GiveawayError } from '@/utils/errors.js';

export class GiveawayService {
    public static async create(params: {
        guildId: string;
        channelId: string;
        hostId: string;
        prize: string;
        winnerCount: number;
        requiredRoleId: string | null;
        endsAt: Date;
    }) {
        const giveaway = await db
            .insert(giveaways)
            .values(params)
            .returning()
            .then((res) => res[0]);
        if (!giveaway) throw new Error('Failed to create giveaway');
        return giveaway;
    }

    public static async attachMessage(giveawayId: number, messageId: string) {
        await db
            .update(giveaways)
            .set({ messageId })
            .where(eq(giveaways.id, giveawayId));
    }

    public static async getById(giveawayId: number) {
        return db
            .select()
            .from(giveaways)
            .where(eq(giveaways.id, giveawayId))
            .then((res) => res[0]);
    }

    /**
     * Enter a giveaway. Relies on the (giveawayId, userId) unique index to
     * atomically reject double-entries even under concurrent button clicks.
     */
    public static async enter(
        giveawayId: number,
        userId: string,
        memberRoleIds: string[]
    ) {
        const giveaway = await this.getById(giveawayId);
        if (!giveaway) throw new GiveawayError('NOT_FOUND');
        if (giveaway.status !== 'active' || giveaway.endsAt <= new Date()) {
            throw new GiveawayError('ALREADY_ENDED');
        }
        if (
            giveaway.requiredRoleId &&
            !memberRoleIds.includes(giveaway.requiredRoleId)
        ) {
            throw new GiveawayError('MISSING_ROLE', {
                role: giveaway.requiredRoleId,
            });
        }

        const inserted = await db
            .insert(giveawayEntries)
            .values({ giveawayId, userId })
            .onConflictDoNothing()
            .returning();
        if (inserted.length === 0) {
            throw new GiveawayError('ALREADY_ENTERED');
        }

        return giveaway;
    }

    public static async getActiveDueForDraw() {
        return db
            .select()
            .from(giveaways)
            .where(
                and(
                    eq(giveaways.status, 'active'),
                    lte(giveaways.endsAt, new Date())
                )
            );
    }

    private static async drawFromEntrants(
        giveawayId: number,
        winnerCount: number,
        excludeUserIds: string[] = []
    ): Promise<string[]> {
        const entries = await db
            .select()
            .from(giveawayEntries)
            .where(eq(giveawayEntries.giveawayId, giveawayId));
        const pool = entries
            .map((e) => e.userId)
            .filter((userId) => !excludeUserIds.includes(userId));

        // Fisher-Yates shuffle
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j]!, pool[i]!];
        }

        return pool.slice(0, winnerCount);
    }

    /**
     * Atomically closes a giveaway (CAS on status) and draws winners. Shared
     * by the auto-draw job and manual `/giveaway end`.
     */
    public static async drawWinners(giveawayId: number) {
        const ended = await db
            .update(giveaways)
            .set({ status: 'ended', endedAt: new Date() })
            .where(
                and(
                    eq(giveaways.id, giveawayId),
                    eq(giveaways.status, 'active')
                )
            )
            .returning()
            .then((res) => res[0]);
        if (!ended) throw new GiveawayError('ALREADY_ENDED');

        const winnerIds = await this.drawFromEntrants(
            giveawayId,
            ended.winnerCount
        );
        if (winnerIds.length > 0) {
            await db
                .insert(giveawayWinners)
                .values(winnerIds.map((userId) => ({ giveawayId, userId })));
        }

        return { giveaway: ended, winnerIds };
    }

    public static async endEarly(giveawayId: number) {
        const giveaway = await this.getById(giveawayId);
        if (!giveaway) throw new GiveawayError('NOT_FOUND');
        return this.drawWinners(giveawayId);
    }

    /**
     * Redraws ALL winners for an ended giveaway from the remaining eligible
     * entrants (previous winners excluded), per the approved design.
     */
    public static async reroll(giveawayId: number) {
        const giveaway = await this.getById(giveawayId);
        if (!giveaway) throw new GiveawayError('NOT_FOUND');
        if (giveaway.status !== 'ended') throw new GiveawayError('NOT_ENDED');

        const previousWinners = await db
            .select()
            .from(giveawayWinners)
            .where(eq(giveawayWinners.giveawayId, giveawayId));
        const previousWinnerIds = previousWinners.map((w) => w.userId);

        const winnerIds = await this.drawFromEntrants(
            giveawayId,
            giveaway.winnerCount,
            previousWinnerIds
        );
        if (winnerIds.length === 0) throw new GiveawayError('NO_ENTRIES');

        await db
            .update(giveawayWinners)
            .set({ rerolled: true })
            .where(eq(giveawayWinners.giveawayId, giveawayId));
        await db
            .insert(giveawayWinners)
            .values(winnerIds.map((userId) => ({ giveawayId, userId })));

        return { giveaway, winnerIds };
    }
}
