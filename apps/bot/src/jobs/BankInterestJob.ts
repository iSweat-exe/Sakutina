import cron from 'node-cron';
import { db, users } from '@sakutina/db';
import { sql, gt } from 'drizzle-orm';
import {
    MAX_BANK_INTEREST_PER_RUN,
    POOR_BANK_THRESHOLD,
    POOR_INTEREST_RATE,
    STANDARD_INTEREST_RATE,
} from '@sakutina/economy';
import { logger } from '../utils/logger.js';

export class BankInterestJob {
    public static start() {
        // Runs every day at 00:00 (midnight UTC)
        cron.schedule('0 0 * * *', async () => {
            try {
                await db
                    .update(users)
                    .set({
                        // Marginal (tax-bracket-style) rate: only the portion of the
                        // balance above POOR_BANK_THRESHOLD earns the lower standard
                        // rate, so small savers earn more and there's no cliff a rich
                        // player could exploit by withdrawing down to the threshold to
                        // farm a better rate. LEAST(...) caps the absolute interest
                        // credited per run so a hoarded fortune can't compound into an
                        // economy-breaking amount no matter how large the balance gets.
                        bank: sql`${users.bank} + LEAST(
                            CASE
                                WHEN ${users.bank} <= ${POOR_BANK_THRESHOLD} THEN ${users.bank} * ${POOR_INTEREST_RATE}
                                ELSE ${POOR_BANK_THRESHOLD} * ${POOR_INTEREST_RATE} + (${users.bank} - ${POOR_BANK_THRESHOLD}) * ${STANDARD_INTEREST_RATE}
                            END,
                            ${MAX_BANK_INTEREST_PER_RUN}
                        )`,
                        updatedAt: new Date(),
                    })
                    .where(gt(users.bank, 0));

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
}
