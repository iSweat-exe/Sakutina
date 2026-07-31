import { EconomyService } from './EconomyService.js';
import { WorkService } from './WorkService.js';

export class ProfileService {
    /**
     * Computes the level based on experience.
     * Formula: Math.floor(Math.sqrt(XP / 10))
     */
    public static calculateLevel(xp: number): number {
        return Math.floor(Math.sqrt(xp / 10));
    }

    /**
     * Retrieves the full unified profile for a user.
     */
    public static async getProfile(discordId: string, guildId: string) {
        const user = await EconomyService.ensureUser(discordId, guildId);

        const level = this.calculateLevel(user.experience);
        const jobInfo = user.currentJob
            ? WorkService.getJob(user.currentJob)
            : null;

        let winRate = 0;
        if (user.casinoGamesPlayed > 0) {
            winRate = Math.round(
                (user.casinoWins / user.casinoGamesPlayed) * 100
            );
        }

        return {
            id: user.discordId,
            createdAt: user.createdAt,
            experience: user.experience,
            level,
            economy: {
                balance: user.balance,
                bank: user.bank,
                total: user.balance + user.bank,
            },
            work: {
                jobTitle: jobInfo ? jobInfo.title : 'Unemployed',
                shiftsDone: user.workShiftsDone,
            },
            casino: {
                gamesPlayed: user.casinoGamesPlayed,
                wins: user.casinoWins,
                losses: user.casinoLosses,
                winRate,
            },
        };
    }
}
