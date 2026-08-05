import { Hono } from 'hono';
import {
    db,
    channelActivity,
    activityHourly,
    voiceChannelStats,
} from '@sakutina/db';
import { desc, eq } from 'drizzle-orm';
import { requireAuth, requireGuildAccess } from '../auth/middleware.js';
import { fetchGuildChannels } from '../discord/rest.js';
import { getGuildId } from '../utils/params.js';
import type { AppEnv } from '../types.js';

export const activityRoutes = new Hono<AppEnv>();

activityRoutes.use('*', requireAuth, requireGuildAccess);

activityRoutes.get('/overview', async (c) => {
    const guildId = getGuildId(c);

    const [channelRows, voiceRows, hourlyRows, channels] = await Promise.all([
        db
            .select({
                channelId: channelActivity.channelId,
                messageCount: channelActivity.messageCount,
                lastMessageAt: channelActivity.lastMessageAt,
            })
            .from(channelActivity)
            .where(eq(channelActivity.guildId, guildId))
            .orderBy(desc(channelActivity.messageCount)),
        db
            .select({
                channelId: voiceChannelStats.channelId,
                totalSeconds: voiceChannelStats.totalSeconds,
                sessionCount: voiceChannelStats.sessionCount,
                currentCount: voiceChannelStats.currentCount,
            })
            .from(voiceChannelStats)
            .where(eq(voiceChannelStats.guildId, guildId))
            .orderBy(desc(voiceChannelStats.totalSeconds)),
        db
            .select({
                hour: activityHourly.hour,
                messageCount: activityHourly.messageCount,
            })
            .from(activityHourly)
            .where(eq(activityHourly.guildId, guildId)),
        fetchGuildChannels(guildId),
    ]);

    const channelNames = new Map(channels.map((ch) => [ch.id, ch.name]));
    const withName = <T extends { channelId: string }>(row: T) => ({
        ...row,
        name: channelNames.get(row.channelId) ?? row.channelId,
    });

    const channelsWithNames = channelRows.map(withName);
    const voiceWithNames = voiceRows.map(withName);

    const hourByHour = new Map(hourlyRows.map((r) => [r.hour, r.messageCount]));
    const hourly = Array.from({ length: 24 }, (_, hour) => ({
        hour,
        messageCount: hourByHour.get(hour) ?? 0,
    }));
    const hoursWithData = hourly.filter((h) => h.messageCount > 0);
    const peakHour = hoursWithData.length
        ? hoursWithData.reduce((a, b) => (b.messageCount > a.messageCount ? b : a))
        : null;
    const quietHour = hoursWithData.length
        ? hoursWithData.reduce((a, b) => (b.messageCount < a.messageCount ? b : a))
        : null;

    return c.json({
        channels: channelsWithNames,
        mostActiveChannel: channelsWithNames[0] ?? null,
        leastActiveChannel:
            channelsWithNames.length > 0
                ? channelsWithNames[channelsWithNames.length - 1]
                : null,
        voiceChannels: voiceWithNames,
        mostActiveVoiceChannel: voiceWithNames[0] ?? null,
        totalVoiceSeconds: voiceRows.reduce((sum, r) => sum + r.totalSeconds, 0),
        currentVoiceUsers: voiceRows.reduce((sum, r) => sum + r.currentCount, 0),
        hourly,
        peakHour,
        quietHour,
    });
});
