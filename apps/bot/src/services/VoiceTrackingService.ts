import type { Client, VoiceState } from 'discord.js';
import { ActivityService } from './ActivityService.js';
import { logger } from '../utils/logger.js';

interface ActiveSession {
    guildId: string;
    channelId: string;
    joinedAt: number;
}

/**
 * Tracks per-member voice-channel sessions in memory (join timestamp) and
 * flushes the elapsed duration to the DB via ActivityService whenever a
 * member leaves/switches channels. Presence (live headcount) is persisted
 * immediately so panel-server, which has no gateway connection, can read it.
 */
export class VoiceTrackingService {
    private static sessions = new Map<string, ActiveSession>();

    private static key(guildId: string, userId: string): string {
        return `${guildId}:${userId}`;
    }

    private static async closeSession(
        userId: string,
        session: ActiveSession
    ): Promise<void> {
        const seconds = (Date.now() - session.joinedAt) / 1000;
        await ActivityService.recordVoiceTime(
            session.guildId,
            session.channelId,
            seconds
        ).catch((err) => {
            logger.error(
                `[VoiceTrackingService] Failed to record voice time for user ${userId}`,
                err
            );
        });
    }

    /**
     * Seeds in-memory sessions for members already connected to voice when
     * the bot boots (so their time is tracked going forward), and resets the
     * persisted live headcount to match reality.
     */
    public static async seedFromClient(client: Client): Promise<void> {
        for (const guild of client.guilds.cache.values()) {
            const liveCounts = new Map<string, number>();

            for (const state of guild.voiceStates.cache.values()) {
                if (!state.channelId || state.member?.user.bot) continue;

                this.sessions.set(this.key(guild.id, state.id), {
                    guildId: guild.id,
                    channelId: state.channelId,
                    joinedAt: Date.now(),
                });
                liveCounts.set(
                    state.channelId,
                    (liveCounts.get(state.channelId) ?? 0) + 1
                );
            }

            await ActivityService.resetVoicePresence(
                guild.id,
                liveCounts
            ).catch((err) => {
                logger.error(
                    `[VoiceTrackingService] Failed to reset voice presence for guild ${guild.id}`,
                    err
                );
            });
        }
    }

    public static async handleVoiceStateUpdate(
        oldState: VoiceState,
        newState: VoiceState
    ): Promise<void> {
        if (newState.member?.user.bot ?? oldState.member?.user.bot) return;
        if (oldState.channelId === newState.channelId) return;

        const userId = newState.id;
        const guildId = newState.guild.id;
        const key = this.key(guildId, userId);

        const existing = this.sessions.get(key);
        if (existing) {
            this.sessions.delete(key);
            await this.closeSession(userId, existing);
        }

        if (newState.channelId) {
            this.sessions.set(key, {
                guildId,
                channelId: newState.channelId,
                joinedAt: Date.now(),
            });
            await ActivityService.incrementVoicePresence(
                guildId,
                newState.channelId
            ).catch((err) => {
                logger.error(
                    `[VoiceTrackingService] Failed to increment voice presence for user ${userId}`,
                    err
                );
            });
        }
    }

    /** Flushes all still-open sessions to the DB. Call on graceful shutdown. */
    public static async flushAll(): Promise<void> {
        const entries = [...this.sessions.entries()];
        this.sessions.clear();
        await Promise.all(
            entries.map(([userId, session]) =>
                this.closeSession(userId, session)
            )
        );
    }
}
