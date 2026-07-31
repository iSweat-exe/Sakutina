import {
    EmbedBuilder,
    Guild,
    GuildMember,
    TextChannel,
    User,
} from 'discord.js';
import { db } from '../repositories/db.js';
import { warns, users, guildSettings, modActions } from '../repositories/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { GuildConfigService } from './GuildConfigService.js';
import { EconomyService } from './EconomyService.js';
import { logger } from '../utils/logger.js';

export class ModerationService {
    /**
     * Send a moderation log to the configured channel
     */
    public static async sendLog(
        guild: Guild,
        action:
            | 'WARN'
            | 'KICK'
            | 'BAN'
            | 'MUTE'
            | 'UNMUTE'
            | 'SOFTBAN'
            | 'CLEARWARNS',
        target: User,
        moderator: User,
        reason: string,
        extraInfo?: string
    ) {
        const config = await GuildConfigService.getGuildSettings(guild.id);
        if (!config || !config.modLogChannel) return;

        const channel = guild.channels.cache.get(config.modLogChannel) as
            TextChannel | undefined;
        if (!channel) return;

        let color = '#3498DB'; // Default blue
        if (action === 'WARN' || action === 'MUTE') color = '#F1C40F'; // Yellow
        if (action === 'KICK' || action === 'SOFTBAN') color = '#E67E22'; // Orange
        if (action === 'BAN') color = '#E74C3C'; // Red
        if (action === 'UNMUTE' || action === 'CLEARWARNS') color = '#2ECC71'; // Green

        const embed = new EmbedBuilder()
            .setTitle(`Mod Action: ${action}`)
            .setColor(color as any)
            .setThumbnail(target.displayAvatarURL())
            .addFields(
                {
                    name: 'Target',
                    value: `${target.tag} (${target.id})`,
                    inline: true,
                },
                {
                    name: 'Moderator',
                    value: `${moderator.tag} (${moderator.id})`,
                    inline: true,
                },
                {
                    name: 'Reason',
                    value: reason || 'No reason provided',
                    inline: false,
                }
            )
            .setTimestamp();

        if (extraInfo) {
            embed.addFields({
                name: 'Extra Info',
                value: extraInfo,
                inline: false,
            });
        }

        try {
            await channel.send({ embeds: [embed] });
        } catch (err) {
            logger.error(`Failed to send mod log in guild ${guild.id}`, err);
        }
    }

    /**
     * Helper to increment moderation stats
     */
    public static async logModActionStats(
        discordId: string,
        guildId: string,
        action: 'KICK' | 'BAN' | 'MUTE'
    ) {
        await EconomyService.ensureUser(discordId, guildId);

        let updateObj = {};
        if (action === 'KICK')
            updateObj = { modKicks: sql`${users.modKicks} + 1` };
        if (action === 'BAN')
            updateObj = { modBans: sql`${users.modBans} + 1` };
        if (action === 'MUTE')
            updateObj = { modMutes: sql`${users.modMutes} + 1` };

        await db
            .update(users)
            .set({ ...updateObj, updatedAt: new Date() })
            .where(and(eq(users.discordId, discordId), eq(users.guildId, guildId)));
    }

    /**
     * Log a detailed moderation action
     */
    public static async logAction(
        guildId: string,
        userId: string,
        moderatorId: string,
        actionType: string,
        reason: string,
        expiresAt?: Date
    ) {
        await db.insert(modActions).values({
            guildId,
            userId,
            moderatorId,
            actionType,
            reason,
            expiresAt,
        });

        // Also update legacy stats counters
        if (actionType === 'KICK' || actionType === 'BAN' || actionType === 'MUTE' || actionType === 'SOFTBAN') {
            await this.logModActionStats(
                userId,
                guildId,
                actionType === 'SOFTBAN' ? 'BAN' : actionType as 'KICK' | 'BAN' | 'MUTE'
            );
        }
    }

    /**
     * Get mod stats for a user
     */
    public static async getModStats(discordId: string, guildId: string) {
        const user = await EconomyService.ensureUser(discordId, guildId);
        return {
            kicks: user.modKicks,
            bans: user.modBans,
            mutes: user.modMutes,
        };
    }

    /**
     * Get mod history for a user
     */
    public static async getModHistory(guildId: string, userId: string) {
        return db
            .select()
            .from(modActions)
            .where(and(eq(modActions.guildId, guildId), eq(modActions.userId, userId)));
    }

    /**
     * Warn a user
     */
    public static async warn(
        guild: Guild,
        target: GuildMember,
        moderator: User,
        reason: string
    ): Promise<{ autobanned: boolean; warnsCount: number; maxWarns: number }> {
        // 1. Insert warn in DB
        await db.insert(warns).values({
            guildId: guild.id,
            userId: target.id,
            moderatorId: moderator.id,
            reason,
        });

        // 2. Check total warns
        const userWarns = await db
            .select()
            .from(warns)
            .where(
                and(eq(warns.guildId, guild.id), eq(warns.userId, target.id))
            );
        const config = await GuildConfigService.getGuildSettings(guild.id);
        const maxWarns = config?.maxWarns ?? 3;

        let autobanned = false;

        // 3. Autoban if threshold reached
        if (userWarns.length >= maxWarns) {
            try {
                await target.ban({
                    reason: `[Auto-Ban] Reached ${maxWarns} warnings.`,
                });
                autobanned = true;
                await this.sendLog(
                    guild,
                    'BAN',
                    target.user,
                    moderator,
                    `[Auto-Ban] Reached ${maxWarns} warnings.`
                );
                await this.logAction(guild.id, target.id, moderator.id, 'BAN', `[Auto-Ban] Reached ${maxWarns} warnings.`);
            } catch (e) {
                logger.error(
                    `Failed to autoban ${target.id} in ${guild.id}`,
                    e
                );
            }
        }

        // 4. Log the warn
        await this.sendLog(
            guild,
            'WARN',
            target.user,
            moderator,
            reason,
            `Total Warnings: ${userWarns.length}/${maxWarns}`
        );
        
        await this.logAction(guild.id, target.id, moderator.id, 'WARN', reason);

        return { autobanned, warnsCount: userWarns.length, maxWarns };
    }

    /**
     * Get warnings for a user
     */
    public static async getWarnings(guildId: string, userId: string) {
        return db
            .select()
            .from(warns)
            .where(and(eq(warns.guildId, guildId), eq(warns.userId, userId)));
    }

    /**
     * Clear all warnings for a user
     */
    public static async clearWarnings(
        guild: Guild,
        target: User,
        moderator: User,
        reason: string
    ) {
        const deleted = await db
            .delete(warns)
            .where(
                and(eq(warns.guildId, guild.id), eq(warns.userId, target.id))
            )
            .returning();
        await this.sendLog(
            guild,
            'CLEARWARNS',
            target,
            moderator,
            reason,
            `Cleared ${deleted.length} warnings.`
        );
        await this.logAction(guild.id, target.id, moderator.id, 'CLEARWARNS', reason);
        return deleted.length;
    }
}
