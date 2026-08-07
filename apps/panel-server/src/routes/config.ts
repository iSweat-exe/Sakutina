import { Hono } from 'hono';
import { requireAuth, requireGuildAccess } from '../auth/middleware.js';
import { ConfigService, type ConfigUpdate } from '../services/ConfigService.js';
import { fetchGuildChannels, fetchGuildRoles } from '../discord/rest.js';
import { bindGuildId, getGuildId } from '../utils/params.js';
import type { AppEnv } from '../types.js';

export const configRoutes = new Hono<AppEnv>();

configRoutes.use('*', bindGuildId, requireAuth, requireGuildAccess);

configRoutes.get('/', async (c) => {
    const guildId = getGuildId(c);
    const settings = await ConfigService.getGuildSettings(guildId);
    return c.json(settings);
});

const TEXT_CHANNEL_TYPES = new Set([0, 5]);

configRoutes.get('/meta', async (c) => {
    const guildId = getGuildId(c);
    const [channels, roles] = await Promise.all([
        fetchGuildChannels(guildId),
        fetchGuildRoles(guildId),
    ]);

    return c.json({
        channels: channels.filter((ch) => TEXT_CHANNEL_TYPES.has(ch.type)),
        roles,
    });
});

configRoutes.patch('/', async (c) => {
    const guildId = getGuildId(c);
    const body = await c.req.json<ConfigUpdate>().catch(() => null);
    if (!body) return c.json({ error: 'Invalid JSON body' }, 400);

    const allowedKeys: (keyof ConfigUpdate)[] = [
        'language',
        'modLogChannel',
        'maxWarns',
        'modLogWarning',
        'autoModEnabled',
        'levelRoleId',
        'levelRoleThreshold',
        'leaderboardChannel',
    ];
    const update: ConfigUpdate = {};
    for (const key of allowedKeys) {
        if (key in body) (update as any)[key] = body[key];
    }

    const updated = await ConfigService.updateGuildSettings(guildId, update);
    return c.json(updated);
});
