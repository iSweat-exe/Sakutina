import { eq, sql, desc } from 'drizzle-orm';
import { db } from '../repositories/db.js';
import { users } from '../repositories/schema.js';
import {
    InsufficientFundsError,
    CooldownError,
    CannotPaySelfError,
    EmptyWalletError,
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
     * Deposit funds from wallet to bank.
     */
    public static async deposit(discordId: string, amount: number) {
        if (amount <= 0) throw new Error('Amount must be positive');
        
        await db.transaction(async (tx) => {
            const user = await tx
                .select()
                .from(users)
                .where(eq(users.discordId, discordId))
                .then((res) => res[0]);
            
            if (!user) throw new Error('User not found');
            if (user.balance < amount) throw new InsufficientFundsError();

            await tx
                .update(users)
                .set({
                    balance: sql`${users.balance} - ${amount}`,
                    bank: sql`${users.bank} + ${amount}`,
                    updatedAt: new Date(),
                })
                .where(eq(users.discordId, discordId));
        });
    }

    /**
     * Withdraw funds from bank to wallet.
     */
    public static async withdraw(discordId: string, amount: number) {
        if (amount <= 0) throw new Error('Amount must be positive');

        await db.transaction(async (tx) => {
            const user = await tx
                .select()
                .from(users)
                .where(eq(users.discordId, discordId))
                .then((res) => res[0]);
            
            if (!user) throw new Error('User not found');
            if (user.bank < amount) throw new InsufficientFundsError(); // or a specific BankInsufficientFundsError, but this is fine

            await tx
                .update(users)
                .set({
                    bank: sql`${users.bank} - ${amount}`,
                    balance: sql`${users.balance} + ${amount}`,
                    updatedAt: new Date(),
                })
                .where(eq(users.discordId, discordId));
        });
    }

    /**
     * Rob another user. Steals 1-5% of their wallet.
     * Has a 24-hour cooldown.
     */
    public static async rob(robberId: string, victimId: string) {
        if (robberId === victimId) throw new Error('Cannot rob yourself');

        await this.ensureUser(robberId);
        await this.ensureUser(victimId);

        let stolenAmount = 0;

        await db.transaction(async (tx) => {
            const robber = await tx
                .select()
                .from(users)
                .where(eq(users.discordId, robberId))
                .then((res) => res[0]);
            const victim = await tx
                .select()
                .from(users)
                .where(eq(users.discordId, victimId))
                .then((res) => res[0]);

            if (!robber || !victim) throw new Error('User not found');

            const now = new Date();
            // Check 24 hour cooldown
            if (robber.robLastAttempt) {
                const diffHours = (now.getTime() - robber.robLastAttempt.getTime()) / (1000 * 60 * 60);
                if (diffHours < 24) {
                    const remainingHours = Math.ceil(24 - diffHours);
                    throw new CooldownError('ROB_COOLDOWN', remainingHours, 'hours');
                }
            }

            if (victim.balance <= 0) {
                // Still update cooldown even if they had no money
                await tx.update(users).set({ robLastAttempt: now }).where(eq(users.discordId, robberId));
                throw new EmptyWalletError();
            }

            // Steal 1-5%
            const percent = Math.floor(Math.random() * 5) + 1;
            stolenAmount = Math.floor(victim.balance * (percent / 100));
            if (stolenAmount === 0) stolenAmount = 1; // steal at least 1 if they have > 0

            await tx
                .update(users)
                .set({
                    balance: sql`${users.balance} - ${stolenAmount}`,
                    updatedAt: new Date(),
                })
                .where(eq(users.discordId, victimId));

            await tx
                .update(users)
                .set({
                    balance: sql`${users.balance} + ${stolenAmount}`,
                    robLastAttempt: now,
                    updatedAt: new Date(),
                })
                .where(eq(users.discordId, robberId));
        });

        return stolenAmount;
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
                const remainingHours = Math.ceil(24 - diffHours);
                throw new CooldownError('DAILY_COOLDOWN', remainingHours, 'hours');
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
