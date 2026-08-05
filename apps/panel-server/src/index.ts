import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { env } from './config/env.js';
import { authRoutes } from './auth/routes.js';
import { configRoutes } from './routes/config.js';
import { moderationRoutes } from './routes/moderation.js';
import { economyRoutes } from './routes/economy.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { activityRoutes } from './routes/activity.js';
import type { AppEnv } from './types.js';

const app = new Hono<AppEnv>();

app.use(
    '*',
    cors({
        origin: env.PANEL_CLIENT_ORIGIN,
        credentials: true,
    })
);

app.get('/health', (c) => c.json({ ok: true }));

app.route('/auth', authRoutes);
app.route('/api/guilds/:guildId/config', configRoutes);
app.route('/api/guilds/:guildId/moderation', moderationRoutes);
app.route('/api/guilds/:guildId/economy', economyRoutes);
app.route('/api/guilds/:guildId/dashboard', dashboardRoutes);
app.route('/api/guilds/:guildId/activity', activityRoutes);

console.log(`[panel-server] Listening on port ${env.PORT}`);

export default {
    port: env.PORT,
    fetch: app.fetch,
};


