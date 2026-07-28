import { eq, sql, desc } from 'drizzle-orm';
import { db } from '../repositories/db.js';
import { users } from '../repositories/schema.js';
import {
    InsufficientFundsError,
    CooldownError,
    CannotPaySelfError,
} from '../utils/errors.js';
import { DAILY_REWARD } from '../modules/economy/constants.js';

export class EconomyService {
    /**
     * Ensure user exists in the database.
     */
    public static async ensureUser(discordId: string) {
        let user = await db
            .select()
            .from(users)
            .where(eq(users.discordId, discordId))
            .then((res) => res[0]);
        if (!user) {
            const inserted = await db
                .insert(users)
                .values({ discordId })
                .returning()
                .then((res) => res[0]);
            if (!inserted) throw new Error('Failed to insert user');
            user = inserted;
        }
        return user;
    }

    /**
     * Get a user's balances (wallet + bank).
     */
    public static async getBalance(discordId: string) {
        const user = await this.ensureUser(discordId);
        return { balance: user.balance, bank: user.bank };
    }

    /**
     * Add funds to a user's wallet.
     */
    public static async addBalance(discordId: string, amount: number) {
        if (amount < 0) throw new Error('Amount must be positive');
        await this.ensureUser(discordId);
        const updated = await db
            .update(users)
            .set({
                balance: sql`${users.balance} + ${amount}`,
                updatedAt: new Date(),
            })
            .where(eq(users.discordId, discordId))
            .returning()
            .then((res) => res[0]);
        if (!updated)
            throw new Error('User unexpectedly disappeared during update');
        return updated.balance;
    }

    /**
     * Remove funds from a user's wallet.
     */
    public static async removeBalance(discordId: string, amount: number) {
        if (amount < 0) throw new Error('Amount must be positive');
        const user = await this.ensureUser(discordId);
        if (user.balance < amount) throw new InsufficientFundsError();

        const updated = await db
            .update(users)
            .set({
                balance: sql`${users.balance} - ${amount}`,
                updatedAt: new Date(),
            })
            .where(eq(users.discordId, discordId))
            .returning()
            .then((res) => res[0]);
        if (!updated)
            throw new Error('User unexpectedly disappeared during update');
        return updated.balance;
    }

    /**
     * Pay another user from wallet to wallet.
     */
    public static async payUser(
        senderId: string,
        receiverId: string,
        amount: number
    ) {
        if (amount <= 0) throw new Error('Amount must be positive');
        if (senderId === receiverId) throw new CannotPaySelfError();

        await this.ensureUser(senderId);
        await this.ensureUser(receiverId);

        await db.transaction(async (tx) => {
            const sender = await tx
                .select()
                .from(users)
                .where(eq(users.discordId, senderId))
                .then((res) => res[0]);
            if (!sender || sender.balance < amount)
                throw new InsufficientFundsError();

            await tx
                .update(users)
                .set({
                    balance: sql`${users.balance} - ${amount}`,
                    updatedAt: new Date(),
                })
                .where(eq(users.discordId, senderId));

            await tx
                .update(users)
                .set({
                    balance: sql`${users.balance} + ${amount}`,
                    updatedAt: new Date(),
                })
                .where(eq(users.discordId, receiverId));
        });
    }

    /**
     * Claim daily rewards.
     */
    public static async claimDaily(
        discordId: string,
        rewardAmount: number = DAILY_REWARD
    ) {
        const user = await this.ensureUser(discordId);

        const now = new Date();
        // 24 hours cooldown
        if (user.dailyLastClaim) {
            const diffHours =
                (now.getTime() - user.dailyLastClaim.getTime()) /
                (1000 * 60 * 60);
            if (diffHours < 24) {
                const remaining = parseFloat((24 - diffHours).toFixed(1));
                throw new CooldownError(remaining, 'hours');
            }
        }

        const updated = await db
            .update(users)
            .set({
                balance: sql`${users.balance} + ${rewardAmount}`,
                dailyLastClaim: now,
                updatedAt: new Date(),
            })
            .where(eq(users.discordId, discordId))
            .returning()
            .then((res) => res[0]);
        if (!updated)
            throw new Error('User unexpectedly disappeared during update');

        return updated.balance;
    }

    /**
     * Get the richest users (wallet + bank), sorted and limited in SQL.
     */
    public static async getLeaderboard(limit: number = 10) {
        return db
            .select({
                discordId: users.discordId,
                total: sql<number>`${users.balance} + ${users.bank}`.as(
                    'total'
                ),
            })
            .from(users)
            .orderBy(desc(sql`${users.balance} + ${users.bank}`))
            .limit(limit);
    }
}
