import cron from 'node-cron';
import { logger } from '../utils/logger.js';
import { EconomyService } from '../services/EconomyService.js';

export class TransactionCleanupJob {
    public static start() {
        // Run every day at 00:00 (Midnight)
        cron.schedule('0 0 * * *', async () => {
            logger.info('Running TransactionCleanupJob...');
            try {
                const deletedCount =
                    await EconomyService.purgeOldTransactions(14);
                logger.info(
                    `TransactionCleanupJob completed. Purged ${deletedCount} transactions older than 14 days.`
                );
            } catch (error) {
                logger.error(
                    'TransactionCleanupJob encountered an error:',
                    error
                );
            }
        });
    }
}


