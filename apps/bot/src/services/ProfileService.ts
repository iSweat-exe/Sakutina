import { EconomyService } from './EconomyService.js';
import { WorkService } from './WorkService.js';
import { ShopService } from './ShopService.js';
import { MarriageService } from './MarriageService.js';
import { calculateLevel } from '../utils/leveling.js';

export class ProfileService {
    /**
     * Computes the level based on experience.
     * Formula: Math.floor(Math.sqrt(XP / 10))
     */
    public static calculateLevel(xp: number): number {
        return calculateLevel(xp);
    }

    /**
     * Retrieves the full unified profile for a user.
     */
    public static async getProfile(discordId: string, guildId: string) {
        const user = await EconomyService.ensureUser(discordId, guildId);

        const level = this.calculateLevel(user.experience);
        const job = user.currentJob
            ? WorkService.getJob(user.currentJob)
            : null;
        const rank = job
            ? WorkService.getRank(job, user.currentJobShifts)
            : null;
        const equippedItem = user.equippedTitle
            ? ShopService.getItem(user.equippedTitle)
            : undefined;
        const marriage = await MarriageService.getMarriage(discordId);

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
            title: equippedItem ? equippedItem.name : null,
            marriedTo: marriage
                ? marriage.user1Id === discordId
                    ? marriage.user2Id
                    : marriage.user1Id
                : null,
            economy: {
                balance: user.balance,
                bank: user.bank,
                total: user.balance + user.bank,
            },
            work: {
                jobTitle: rank ? rank.title : 'Unemployed',
                shiftsDone: user.workShiftsDone,
                streak: user.workStreak,
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


