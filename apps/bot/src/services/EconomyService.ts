import { eq, sql, desc, and } from 'drizzle-orm';
import { db, users, transactions } from '@sakutina/db';
import {
    InsufficientFundsError,
    CooldownError,
    CannotPaySelfError,
    EmptyWalletError,
} from '../utils/errors.js';
import { DAILY_REWARD } from '../modules/economy/constants.js';

export class EconomyService {
    /**
     * Log a transaction.
     */
    public static async logTransaction(
        userId: string,
        guildId: string,
        type: string,
        amount: number,
        details?: string,
        tx?: any
    ) {
        const executor = tx ?? db;
        await executor.insert(transactions).values({
            userId,
            guildId,
            type,
            amount,
            details,
        });
    }

    /**
     * Get recent transactions for a user in a specific guild.
     */
    public static async getRecentTransactions(
        userId: string,
        guildId: string,
        limit = 10
    ) {
        return db
            .select()
            .from(transactions)
            .where(
                and(
                    eq(transactions.userId, userId),
                    eq(transactions.guildId, guildId)
                )
            )
            .orderBy(desc(transactions.createdAt))
            .limit(limit);
    }

    /**
     * Delete transactions older than X days. Returns the number of rows deleted.
     */
    public static async purgeOldTransactions(days = 14) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        const deleted = await db
            .delete(transactions)
            .where(sql`${transactions.createdAt} < ${cutoffDate}`)
            .returning({ id: transactions.id });
        return deleted.length;
    }

    /**
     * Ensure user exists in the database for a specific guild.
     */
    public static async ensureUser(discordId: string, guildId: string) {
        let user = await db
            .select()
            .from(users)
            .where(
                and(eq(users.discordId, discordId), eq(users.guildId, guildId))
            )
            .then((res) => res[0]);
        if (!user) {
            const inserted = await db
                .insert(users)
                .values({ discordId, guildId })
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
    public static async getBalance(discordId: string, guildId: string) {
        const user = await this.ensureUser(discordId, guildId);
        return { balance: user.balance, bank: user.bank };
    }

    /**
     * Add funds to a user's wallet.
     */
    public static async addBalance(
        discordId: string,
        guildId: string,
        amount: number,
        reason: string = 'Admin added balance',
        type: string = 'add_balance'
    ) {
        if (amount < 0) throw new Error('Amount must be positive');
        await this.ensureUser(discordId, guildId);
        const updated = await db
            .update(users)
            .set({
                balance: sql`${users.balance} + ${amount}`,
                updatedAt: new Date(),
            })
            .where(
                and(eq(users.discordId, discordId), eq(users.guildId, guildId))
            )
            .returning()
            .then((res) => res[0]);
        if (!updated)
            throw new Error('User unexpectedly disappeared during update');
        await this.logTransaction(discordId, guildId, type, amount, reason);
        return updated.balance;
    }

    /**
     * Remove funds from a user's wallet.
     */
    public static async removeBalance(
        discordId: string,
        guildId: string,
        amount: number,
        reason: string = 'Admin removed balance',
        type: string = 'remove_balance'
    ) {
        if (amount < 0) throw new Error('Amount must be positive');
        const user = await this.ensureUser(discordId, guildId);
        if (user.balance < amount) throw new InsufficientFundsError();

        const updated = await db
            .update(users)
            .set({
                balance: sql`${users.balance} - ${amount}`,
                updatedAt: new Date(),
            })
            .where(
                and(eq(users.discordId, discordId), eq(users.guildId, guildId))
            )
            .returning()
            .then((res) => res[0]);
        if (!updated)
            throw new Error('User unexpectedly disappeared during update');
        await this.logTransaction(discordId, guildId, type, -amount, reason);
        return updated.balance;
    }

    /**
     * Pay another user from wallet to wallet.
     */
    public static async payUser(
        senderId: string,
        receiverId: string,
        guildId: string,
        amount: number
    ) {
        if (amount <= 0) throw new Error('Amount must be positive');
        if (senderId === receiverId) throw new CannotPaySelfError();

        await this.ensureUser(senderId, guildId);
        await this.ensureUser(receiverId, guildId);

        await db.transaction(async (tx) => {
            const sender = await tx
                .select()
                .from(users)
                .where(
                    and(
                        eq(users.discordId, senderId),
                        eq(users.guildId, guildId)
                    )
                )
                .then((res) => res[0]);
            if (!sender || sender.balance < amount)
                throw new InsufficientFundsError();

            await tx
                .update(users)
                .set({
                    balance: sql`${users.balance} - ${amount}`,
                    updatedAt: new Date(),
                })
                .where(
                    and(
                        eq(users.discordId, senderId),
                        eq(users.guildId, guildId)
                    )
                );

            await tx
                .update(users)
                .set({
                    balance: sql`${users.balance} + ${amount}`,
                    updatedAt: new Date(),
                })
                .where(
                    and(
                        eq(users.discordId, receiverId),
                        eq(users.guildId, guildId)
                    )
                );

            await this.logTransaction(
                senderId,
                guildId,
                'pay',
                -amount,
                `Paid ${amount} to user ${receiverId}`,
                tx
            );
            await this.logTransaction(
                receiverId,
                guildId,
                'pay',
                amount,
                `Received ${amount} from user ${senderId}`,
                tx
            );
        });
    }

    /**
     * Deposit funds from wallet to bank.
     */
    public static async deposit(
        discordId: string,
        guildId: string,
        amount: number
    ) {
        if (amount <= 0) throw new Error('Amount must be positive');
        await this.ensureUser(discordId, guildId);

        await db.transaction(async (tx) => {
            const user = await tx
                .select()
                .from(users)
                .where(
                    and(
                        eq(users.discordId, discordId),
                        eq(users.guildId, guildId)
                    )
                )
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
                .where(
                    and(
                        eq(users.discordId, discordId),
                        eq(users.guildId, guildId)
                    )
                );

            await this.logTransaction(
                discordId,
                guildId,
                'bank_deposit',
                amount,
                `Deposited ${amount} to bank`,
                tx
            );
        });
    }

    /**
     * Withdraw funds from bank to wallet.
     */
    public static async withdraw(
        discordId: string,
        guildId: string,
        amount: number
    ) {
        if (amount <= 0) throw new Error('Amount must be positive');
        await this.ensureUser(discordId, guildId);

        await db.transaction(async (tx) => {
            const user = await tx
                .select()
                .from(users)
                .where(
                    and(
                        eq(users.discordId, discordId),
                        eq(users.guildId, guildId)
                    )
                )
                .then((res) => res[0]);

            if (!user) throw new Error('User not found');
            if (user.bank < amount) throw new InsufficientFundsError();

            await tx
                .update(users)
                .set({
                    bank: sql`${users.bank} - ${amount}`,
                    balance: sql`${users.balance} + ${amount}`,
                    updatedAt: new Date(),
                })
                .where(
                    and(
                        eq(users.discordId, discordId),
                        eq(users.guildId, guildId)
                    )
                );

            await this.logTransaction(
                discordId,
                guildId,
                'bank_withdraw',
                amount,
                `Withdrew ${amount} from bank`,
                tx
            );
        });
    }

    /**
     * Rob another user. Steals 1-5% of their wallet.
     * Has a 24-hour cooldown.
     */
    public static async rob(
        robberId: string,
        victimId: string,
        guildId: string
    ) {
        if (robberId === victimId) throw new Error('Cannot rob yourself');

        await this.ensureUser(robberId, guildId);
        await this.ensureUser(victimId, guildId);

        let stolenAmount = 0;

        await db.transaction(async (tx) => {
            const robber = await tx
                .select()
                .from(users)
                .where(
                    and(
                        eq(users.discordId, robberId),
                        eq(users.guildId, guildId)
                    )
                )
                .then((res) => res[0]);
            const victim = await tx
                .select()
                .from(users)
                .where(
                    and(
                        eq(users.discordId, victimId),
                        eq(users.guildId, guildId)
                    )
                )
                .then((res) => res[0]);

            if (!robber || !victim) throw new Error('User not found');

            const now = new Date();
            // Check 24 hour cooldown
            if (robber.robLastAttempt) {
                const diffHours =
                    (now.getTime() - robber.robLastAttempt.getTime()) /
                    (1000 * 60 * 60);
                if (diffHours < 24) {
                    const remainingHours = Math.ceil(24 - diffHours);
                    throw new CooldownError(
                        'ROB_COOLDOWN',
                        remainingHours,
                        'hours'
                    );
                }
            }

            if (victim.balance <= 0) {
                // Still update cooldown even if they had no money
                await tx
                    .update(users)
                    .set({ robLastAttempt: now })
                    .where(
                        and(
                            eq(users.discordId, robberId),
                            eq(users.guildId, guildId)
                        )
                    );
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
                .where(
                    and(
                        eq(users.discordId, victimId),
                        eq(users.guildId, guildId)
                    )
                );

            await tx
                .update(users)
                .set({
                    balance: sql`${users.balance} + ${stolenAmount}`,
                    robLastAttempt: now,
                    updatedAt: new Date(),
                })
                .where(
                    and(
                        eq(users.discordId, robberId),
                        eq(users.guildId, guildId)
                    )
                );

            await this.logTransaction(
                robberId,
                guildId,
                'rob',
                stolenAmount,
                `Robbed ${stolenAmount} from user ${victimId}`,
                tx
            );
            await this.logTransaction(
                victimId,
                guildId,
                'robbed',
                -stolenAmount,
                `Robbed by user ${robberId} for ${stolenAmount}`,
                tx
            );
        });

        return stolenAmount;
    }

    /**
     * Claim daily rewards.
     */
    public static async claimDaily(
        discordId: string,
        guildId: string,
        rewardAmount: number = DAILY_REWARD
    ) {
        const user = await this.ensureUser(discordId, guildId);

        const now = new Date();
        // 24 hours cooldown
        if (user.dailyLastClaim) {
            const diffHours =
                (now.getTime() - user.dailyLastClaim.getTime()) /
                (1000 * 60 * 60);
            if (diffHours < 24) {
                const remainingHours = Math.ceil(24 - diffHours);
                throw new CooldownError(
                    'DAILY_COOLDOWN',
                    remainingHours,
                    'hours'
                );
            }
        }

        const updated = await db
            .update(users)
            .set({
                balance: sql`${users.balance} + ${rewardAmount}`,
                dailyLastClaim: now,
                updatedAt: new Date(),
            })
            .where(
                and(eq(users.discordId, discordId), eq(users.guildId, guildId))
            )
            .returning()
            .then((res) => res[0]);
        if (!updated)
            throw new Error('User unexpectedly disappeared during update');

        await this.logTransaction(
            discordId,
            guildId,
            'daily',
            rewardAmount,
            'Claimed daily reward'
        );

        return updated.balance;
    }

    /**
     * Get the richest users in a guild, sorted and limited in SQL.
     */
    public static async getLeaderboard(guildId: string, limit: number = 10) {
        return db
            .select({
                discordId: users.discordId,
                total: sql<number>`${users.balance} + ${users.bank}`.as(
                    'total'
                ),
            })
            .from(users)
            .where(eq(users.guildId, guildId))
            .orderBy(desc(sql`${users.balance} + ${users.bank}`))
            .limit(limit);
    }
}


