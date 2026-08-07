import cron from 'node-cron';
import { db, users } from '@sakutina/db';
import { sql, gt, inArray } from 'drizzle-orm';
import { computeBankInterest } from '@sakutina/economy';
import { logger } from '../utils/logger.js';

export class BankInterestJob {
    public static start() {
        // Runs every day at 00:00 (midnight UTC)
        cron.schedule('0 0 * * *', async () => {
            try {
                await BankInterestJob.run();

                logger.info(
                    '[BankInterestJob] Applied bank interest successfully.'
                );
            } catch (error) {
                logger.error(
                    '[BankInterestJob] Error applying bank interest',
                    error
                );
            }
        });
    }

    /**
     * Credits interest to every eligible balance using the shared
     * computeBankInterest() formula so the cron path can never drift from
     * the tested/simulated one. Applied as a single batched UPDATE (CASE per
     * id) inside a transaction rather than one round trip per user.
     */
    public static async run() {
        await db.transaction(async (tx) => {
            const accounts = await tx
                .select({ id: users.id, bank: users.bank })
                .from(users)
                .where(gt(users.bank, 0));

            if (accounts.length === 0) return;

            const cases = sql.join(
                accounts.map(
                    (account) =>
                        sql`WHEN ${users.id} = ${account.id} THEN ${users.bank} + ${computeBankInterest(account.bank)}`
                ),
                sql` `
            );

            await tx
                .update(users)
                .set({
                    bank: sql`CASE ${cases} ELSE ${users.bank} END`,
                    updatedAt: new Date(),
                })
                .where(
                    inArray(
                        users.id,
                        accounts.map((account) => account.id)
                    )
                );
        });
    }
}
