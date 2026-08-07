import { eq, sql, desc, and, gte, isNull, lt, or } from 'drizzle-orm';
import { db, users, transactions } from '@sakutina/db';
import {
    InsufficientFundsError,
    CooldownError,
    CannotPaySelfError,
    EmptyWalletError,
} from '../utils/errors.js';
import { DAILY_REWARD, WELCOME_BONUS } from '../modules/economy/constants.js';

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

            await this.addBalance(
                discordId,
                guildId,
                WELCOME_BONUS,
                'Welcome bonus for new player',
                'welcome_bonus'
            );
            user.balance += WELCOME_BONUS;

            const { QuestService } = await import('./QuestService.js');
            await QuestService.assignQuests(discordId, guildId, 'daily').catch(
                () => {}
            );
            await QuestService.assignQuests(discordId, guildId, 'weekly').catch(
                () => {}
            );
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
     * Atomically debit `amount` from a user's wallet balance via a
     * compare-and-swap `UPDATE ... WHERE balance >= amount`, so concurrent
     * debits (double-click, two devices, casino/shop/pay racing each other)
     * can never push the balance negative. Returns the updated row, or
     * `null` if the guard failed (insufficient funds, possibly because a
     * concurrent debit won the race first). Accepts an optional transaction
     * so callers can compose it with other writes atomically.
     */
    public static async tryDebit(
        discordId: string,
        guildId: string,
        amount: number,
        tx?: any
    ) {
        if (amount < 0) throw new Error('Amount must be positive');
        const executor = tx ?? db;
        const updated = await executor
            .update(users)
            .set({
                balance: sql`${users.balance} - ${amount}`,
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(users.discordId, discordId),
                    eq(users.guildId, guildId),
                    gte(users.balance, amount)
                )
            )
            .returning();
        return updated[0] ?? null;
    }

    /**
     * Same compare-and-swap pattern as `tryDebit`, but against the bank
     * balance (used by `withdraw`).
     */
    public static async tryDebitBank(
        discordId: string,
        guildId: string,
        amount: number,
        tx?: any
    ) {
        if (amount < 0) throw new Error('Amount must be positive');
        const executor = tx ?? db;
        const updated = await executor
            .update(users)
            .set({
                bank: sql`${users.bank} - ${amount}`,
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(users.discordId, discordId),
                    eq(users.guildId, guildId),
                    gte(users.bank, amount)
                )
            )
            .returning();
        return updated[0] ?? null;
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
        await this.ensureUser(discordId, guildId);
        const updated = await this.tryDebit(discordId, guildId, amount);
        if (!updated) throw new InsufficientFundsError();
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
            const debited = await this.tryDebit(senderId, guildId, amount, tx);
            if (!debited) throw new InsufficientFundsError();

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
            const debited = await this.tryDebit(discordId, guildId, amount, tx);
            if (!debited) throw new InsufficientFundsError();

            await tx
                .update(users)
                .set({
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
            const debited = await this.tryDebitBank(
                discordId,
                guildId,
                amount,
                tx
            );
            if (!debited) throw new InsufficientFundsError();

            await tx
                .update(users)
                .set({
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
     *
     * The cooldown is claimed with a single CAS `UPDATE ... WHERE
     * robLastAttempt IS NULL OR robLastAttempt < cutoff`, committed in its
     * own transaction before the theft is attempted — concurrent `/rob`
     * calls from the same robber can no longer both read a stale
     * `robLastAttempt` and both pass the check. It's committed separately
     * (not folded into the theft transaction) so it survives even when the
     * theft itself fails, matching the original "cooldown always spent"
     * behavior for an empty-wallet victim.
     */
    public static async rob(
        robberId: string,
        victimId: string,
        guildId: string
    ) {
        if (robberId === victimId) throw new Error('Cannot rob yourself');

        await this.ensureUser(robberId, guildId);
        await this.ensureUser(victimId, guildId);

        const now = new Date();
        const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const claimed = await db
            .update(users)
            .set({ robLastAttempt: now, updatedAt: now })
            .where(
                and(
                    eq(users.discordId, robberId),
                    eq(users.guildId, guildId),
                    or(
                        isNull(users.robLastAttempt),
                        lt(users.robLastAttempt, cutoff)
                    )
                )
            )
            .returning()
            .then((res) => res[0]);

        if (!claimed) {
            const robber = await db
                .select()
                .from(users)
                .where(
                    and(
                        eq(users.discordId, robberId),
                        eq(users.guildId, guildId)
                    )
                )
                .then((res) => res[0]);
            const diffHours = robber?.robLastAttempt
                ? (now.getTime() - robber.robLastAttempt.getTime()) /
                  (1000 * 60 * 60)
                : 24;
            const remainingHours = Math.max(1, Math.ceil(24 - diffHours));
            throw new CooldownError('ROB_COOLDOWN', remainingHours, 'hours');
        }

        let stolenAmount = 0;

        await db.transaction(async (tx) => {
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
            if (!victim) throw new Error('User not found');
            if (victim.balance <= 0) throw new EmptyWalletError();

            // Steal 1-5%
            const percent = Math.floor(Math.random() * 5) + 1;
            stolenAmount = Math.floor(victim.balance * (percent / 100));
            if (stolenAmount === 0) stolenAmount = 1; // steal at least 1 if they have > 0

            const debited = await this.tryDebit(
                victimId,
                guildId,
                stolenAmount,
                tx
            );
            if (!debited) throw new EmptyWalletError();

            await tx
                .update(users)
                .set({
                    balance: sql`${users.balance} + ${stolenAmount}`,
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
     * Claim daily rewards. The cooldown check and the reward grant happen
     * in a single CAS `UPDATE ... WHERE dailyLastClaim IS NULL OR
     * dailyLastClaim < cutoff`, so concurrent claims can't both read a
     * stale `dailyLastClaim` and both pass the check — only one `UPDATE`
     * can match the guard.
     */
    public static async claimDaily(
        discordId: string,
        guildId: string,
        rewardAmount: number = DAILY_REWARD
    ) {
        await this.ensureUser(discordId, guildId);

        const now = new Date();
        const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const updated = await db
            .update(users)
            .set({
                balance: sql`${users.balance} + ${rewardAmount}`,
                dailyLastClaim: now,
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(users.discordId, discordId),
                    eq(users.guildId, guildId),
                    or(
                        isNull(users.dailyLastClaim),
                        lt(users.dailyLastClaim, cutoff)
                    )
                )
            )
            .returning()
            .then((res) => res[0]);

        if (!updated) {
            const user = await db
                .select()
                .from(users)
                .where(
                    and(
                        eq(users.discordId, discordId),
                        eq(users.guildId, guildId)
                    )
                )
                .then((res) => res[0]);
            const diffHours = user?.dailyLastClaim
                ? (now.getTime() - user.dailyLastClaim.getTime()) /
                  (1000 * 60 * 60)
                : 24;
            const remainingHours = Math.max(1, Math.ceil(24 - diffHours));
            throw new CooldownError('DAILY_COOLDOWN', remainingHours, 'hours');
        }

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
