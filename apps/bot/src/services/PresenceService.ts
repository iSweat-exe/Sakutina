import { ActivityType, Client } from 'discord.js';
import { sql } from 'drizzle-orm';
import { db, users } from '@sakutina/db';
import { logger } from '../utils/logger.js';

const ROTATION_INTERVAL_MS = 45_000;

export class PresenceService {
    private static intervalHandle: ReturnType<typeof setInterval> | null = null;
    private static index = 0;

    /**
     * Starts rotating the bot's Discord presence through a small set of
     * informational statuses. Call once, after the client is ready.
     */
    public static start(client: Client) {
        if (this.intervalHandle) return;

        this.updatePresence(client).catch(() => {});
        this.intervalHandle = setInterval(() => {
            this.index++;
            this.updatePresence(client).catch((err) => {
                logger.error(
                    '[PresenceService] Failed to update presence',
                    err
                );
            });
        }, ROTATION_INTERVAL_MS);
    }

    public static stop() {
        if (this.intervalHandle) clearInterval(this.intervalHandle);
        this.intervalHandle = null;
    }

    private static async updatePresence(client: Client) {
        if (!client.user) return;
        const statuses = await this.buildStatuses(client);
        const text = statuses[this.index % statuses.length];
        if (!text) return;

        client.user.setPresence({
            status: 'online',
            activities: [{ name: text, type: ActivityType.Watching }],
        });
    }

    private static async buildStatuses(client: Client): Promise<string[]> {
        const guildCount = client.guilds.cache.size;
        const memberCount = client.guilds.cache.reduce(
            (sum, g) => sum + (g.memberCount ?? 0),
            0
        );

        let trackedUsers = 0;
        try {
            const [row] = await db
                .select({ count: sql<number>`count(*)` })
                .from(users);
            trackedUsers = Number(row?.count ?? 0);
        } catch {
            // DB hiccup shouldn't break presence rotation — skip this tick's count.
        }

        return [
            '/help pour les commandes',
            `${guildCount} serveur${guildCount > 1 ? 's' : ''}`,
            `${memberCount} membres`,
            `${trackedUsers} joueurs actifs`,
        ];
    }
}
