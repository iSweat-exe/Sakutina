import { GuildMember } from 'discord.js';
import { GuildConfigService } from './GuildConfigService.js';
import { logger } from '../utils/logger.js';

export class LevelRoleService {
    /**
     * Grants the guild's configured level-up role to a member if they've
     * reached the threshold and don't already have it.
     * Returns true if the role was just granted.
     */
    public static async checkAndAssignRole(
        member: GuildMember,
        level: number
    ): Promise<boolean> {
        const config = await GuildConfigService.getGuildSettings(
            member.guild.id
        );
        if (!config.levelRoleId || !config.levelRoleThreshold) return false;
        if (level < config.levelRoleThreshold) return false;
        if (member.roles.cache.has(config.levelRoleId)) return false;

        try {
            await member.roles.add(config.levelRoleId);
            return true;
        } catch (error) {
            logger.error(
                `[LevelRoleService] Failed to assign role ${config.levelRoleId} to ${member.id} in ${member.guild.id}`,
                error
            );
            return false;
        }
    }
}
