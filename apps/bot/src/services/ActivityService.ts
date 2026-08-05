import { desc, eq, sql } from 'drizzle-orm';
import {
    db,
    channelActivity,
    activityHourly,
    voiceChannelStats,
} from '@sakutina/db';

export interface ChannelActivityRow {
    channelId: string;
    messageCount: number;
    lastMessageAt: Date | null;
}

export interface HourlyActivityRow {
    hour: number;
    messageCount: number;
}

export interface VoiceChannelStatRow {
    channelId: string;
    totalSeconds: number;
    sessionCount: number;
    currentCount: number;
}

export class ActivityService {
    /** Increments the per-channel message counter and the current UTC hour bucket. */
    public static async recordMessage(
        guildId: string,
        channelId: string
    ): Promise<void> {
        const now = new Date();
        const hour = now.getUTCHours();

        await Promise.all([
            db
                .insert(channelActivity)
                .values({
                    guildId,
                    channelId,
                    messageCount: 1,
                    lastMessageAt: now,
                })
                .onConflictDoUpdate({
                    target: [
                        channelActivity.guildId,
                        channelActivity.channelId,
                    ],
                    set: {
                        messageCount: sql`${channelActivity.messageCount} + 1`,
                        lastMessageAt: now,
                    },
                }),
            db
                .insert(activityHourly)
                .values({ guildId, hour, messageCount: 1 })
                .onConflictDoUpdate({
                    target: [activityHourly.guildId, activityHourly.hour],
                    set: {
                        messageCount: sql`${activityHourly.messageCount} + 1`,
                    },
                }),
        ]);
    }

    /** Marks a member as having joined a voice channel (bumps the live headcount). */
    public static async incrementVoicePresence(
        guildId: string,
        channelId: string
    ): Promise<void> {
        await db
            .insert(voiceChannelStats)
            .values({ guildId, channelId, currentCount: 1 })
            .onConflictDoUpdate({
                target: [
                    voiceChannelStats.guildId,
                    voiceChannelStats.channelId,
                ],
                set: {
                    currentCount: sql`${voiceChannelStats.currentCount} + 1`,
                },
            });
    }

    /** Closes out a voice session: adds elapsed seconds and drops the live headcount. */
    public static async recordVoiceTime(
        guildId: string,
        channelId: string,
        seconds: number
    ): Promise<void> {
        const elapsed = Math.max(0, Math.round(seconds));

        await db
            .insert(voiceChannelStats)
            .values({
                guildId,
                channelId,
                totalSeconds: elapsed,
                sessionCount: 1,
                currentCount: 0,
            })
            .onConflictDoUpdate({
                target: [
                    voiceChannelStats.guildId,
                    voiceChannelStats.channelId,
                ],
                set: {
                    totalSeconds: sql`${voiceChannelStats.totalSeconds} + ${elapsed}`,
                    sessionCount: sql`${voiceChannelStats.sessionCount} + 1`,
                    currentCount: sql`GREATEST(${voiceChannelStats.currentCount} - 1, 0)`,
                },
            });
    }

    /**
     * Resets the live voice headcount for a guild to match reality. Called on
     * bot startup since counts persisted in the DB may be stale after a
     * restart (members could have joined/left while the bot was offline).
     */
    public static async resetVoicePresence(
        guildId: string,
        liveCounts: Map<string, number>
    ): Promise<void> {
        await db
            .update(voiceChannelStats)
            .set({ currentCount: 0 })
            .where(eq(voiceChannelStats.guildId, guildId));

        for (const [channelId, count] of liveCounts) {
            await db
                .insert(voiceChannelStats)
                .values({ guildId, channelId, currentCount: count })
                .onConflictDoUpdate({
                    target: [
                        voiceChannelStats.guildId,
                        voiceChannelStats.channelId,
                    ],
                    set: { currentCount: count },
                });
        }
    }

    public static async getChannelActivity(
        guildId: string
    ): Promise<ChannelActivityRow[]> {
        return db
            .select({
                channelId: channelActivity.channelId,
                messageCount: channelActivity.messageCount,
                lastMessageAt: channelActivity.lastMessageAt,
            })
            .from(channelActivity)
            .where(eq(channelActivity.guildId, guildId))
            .orderBy(desc(channelActivity.messageCount));
    }

    /** Returns all 24 UTC hour buckets, filling in zero for hours with no data. */
    public static async getHourlyActivity(
        guildId: string
    ): Promise<HourlyActivityRow[]> {
        const rows = await db
            .select({
                hour: activityHourly.hour,
                messageCount: activityHourly.messageCount,
            })
            .from(activityHourly)
            .where(eq(activityHourly.guildId, guildId));

        const byHour = new Map(rows.map((r) => [r.hour, r.messageCount]));
        return Array.from({ length: 24 }, (_, hour) => ({
            hour,
            messageCount: byHour.get(hour) ?? 0,
        }));
    }

    public static async getVoiceChannelStats(
        guildId: string
    ): Promise<VoiceChannelStatRow[]> {
        return db
            .select({
                channelId: voiceChannelStats.channelId,
                totalSeconds: voiceChannelStats.totalSeconds,
                sessionCount: voiceChannelStats.sessionCount,
                currentCount: voiceChannelStats.currentCount,
            })
            .from(voiceChannelStats)
            .where(eq(voiceChannelStats.guildId, guildId))
            .orderBy(desc(voiceChannelStats.totalSeconds));
    }
}
