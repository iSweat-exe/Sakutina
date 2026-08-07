import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { bodyLimit } from 'hono/body-limit';
import { env } from './config/env.js';
import { authRoutes } from './auth/routes.js';
import { configRoutes } from './routes/config.js';
import { moderationRoutes } from './routes/moderation.js';
import { economyRoutes } from './routes/economy.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { activityRoutes } from './routes/activity.js';
import { gameRoutes } from './routes/game.js';
import { workRoutes } from './routes/work.js';
import { investRoutes } from './routes/invest.js';
import { profileRoutes } from './routes/profile.js';
import type { AppEnv } from './types.js';

const app = new Hono<AppEnv>();

app.use(
    '*',
    cors({
        origin: env.PANEL_CLIENT_ORIGIN,
        credentials: true,
    })
);
app.use('*', secureHeaders());
app.use(
    '*',
    bodyLimit({
        maxSize: 100 * 1024,
        onError: (c) => c.json({ error: 'Request body too large' }, 413),
    })
);

app.onError((err, c) => {
    console.error(err);
    return c.json({ error: 'Internal server error' }, 500);
});
app.notFound((c) => c.json({ error: 'Not found' }, 404));

app.get('/health', (c) => c.json({ ok: true }));

app.route('/auth', authRoutes);
app.route('/api/guilds/:guildId/config', configRoutes);
app.route('/api/guilds/:guildId/moderation', moderationRoutes);
app.route('/api/guilds/:guildId/economy', economyRoutes);
app.route('/api/guilds/:guildId/dashboard', dashboardRoutes);
app.route('/api/guilds/:guildId/activity', activityRoutes);
app.route('/api/guilds/:guildId/game', gameRoutes);
app.route('/api/guilds/:guildId/work', workRoutes);
app.route('/api/guilds/:guildId/invest', investRoutes);
app.route('/api/guilds/:guildId/profile', profileRoutes);

console.log(`[panel-server] Listening on port ${env.PORT}`);

export default {
    port: env.PORT,
    fetch: app.fetch,
};
