import cron from 'node-cron';
import { db } from '../repositories/db.js';
import { users } from '../repositories/schema.js';
import { sql, gt } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

export class BankInterestJob {
    public static start() {
        // Runs every day at 00:00 (midnight UTC)
        cron.schedule('0 0 * * *', async () => {
            try {
                await db
                    .update(users)
                    .set({
                        bank: sql`${users.bank} * 1.01`, // +1% interest
                        updatedAt: new Date(),
                    })
                    .where(gt(users.bank, 0));

                logger.info(
                    '[BankInterestJob] Applied 1% interest to all bank accounts.'
                );
            } catch (error) {
                logger.error(
                    '[BankInterestJob] Error applying bank interest',
                    error
                );
            }
        });
    }
}
