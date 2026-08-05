import cron from 'node-cron';
import { logger } from '../utils/logger.js';
import { InvestmentService } from '../services/InvestmentService.js';

export class StockPriceJob {
    public static start() {
        // Runs every minute — frequent enough that /invest chart's live
        // auto-refresh actually shows movement between refreshes.
        cron.schedule('* * * * *', async () => {
            try {
                await InvestmentService.tickAllPrices();
            } catch (error) {
                logger.error(
                    '[StockPriceJob] Error updating stock prices',
                    error
                );
            }
        });
    }
}
