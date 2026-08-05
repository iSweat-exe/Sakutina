import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { env } from '../config/env.js';
import {
    exchangeCodeForToken,
    fetchBotGuildIds,
    fetchDiscordUser,
    fetchUserGuilds,
    hasManageAccess,
} from '../discord/api.js';
import {
    createSessionToken,
    SESSION_COOKIE,
    type SessionGuild,
} from './session.js';
import { requireAuth } from './middleware.js';
import type { AppEnv } from '../types.js';

const OAUTH_STATE_COOKIE = 'sakutina_oauth_state';
const isProd = env.NODE_ENV === 'production';

export const authRoutes = new Hono<AppEnv>();

authRoutes.get('/login', (c) => {
    const state = crypto.randomUUID();
    setCookie(c, OAUTH_STATE_COOKIE, state, {
        httpOnly: true,
        sameSite: 'Lax',
        secure: isProd,
        path: '/',
        maxAge: 5 * 60,
    });

    const authorizeUrl = new URL('https://discord.com/api/oauth2/authorize');
    authorizeUrl.searchParams.set('client_id', env.CLIENT_ID);
    authorizeUrl.searchParams.set('redirect_uri', env.DISCORD_REDIRECT_URI);
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('scope', 'identify guilds');
    authorizeUrl.searchParams.set('state', state);

    return c.redirect(authorizeUrl.toString());
});

authRoutes.get('/callback', async (c) => {
    const code = c.req.query('code');
    const state = c.req.query('state');
    const expectedState = getCookie(c, OAUTH_STATE_COOKIE);

    deleteCookie(c, OAUTH_STATE_COOKIE, { path: '/' });

    if (!code || !state || !expectedState || state !== expectedState) {
        return c.json({ error: 'Invalid OAuth state' }, 400);
    }

    try {
        const token = await exchangeCodeForToken(code);
        const [discordUser, userGuilds, botGuildIds] = await Promise.all([
            fetchDiscordUser(token.access_token),
            fetchUserGuilds(token.access_token),
            fetchBotGuildIds(),
        ]);

        const guilds: SessionGuild[] = userGuilds
            .filter((g) => botGuildIds.has(g.id))
            .map((g) => ({
                id: g.id,
                name: g.name,
                icon: g.icon,
                hasAccess: g.owner || hasManageAccess(g.permissions),
            }));

        const sessionToken = await createSessionToken({
            discordUserId: discordUser.id,
            username: discordUser.global_name ?? discordUser.username,
            avatar: discordUser.avatar,
            guilds,
        });

        setCookie(c, SESSION_COOKIE, sessionToken, {
            httpOnly: true,
            sameSite: 'Lax',
            secure: isProd,
            path: '/',
            maxAge: 60 * 60,
        });

        return c.redirect(env.PANEL_CLIENT_ORIGIN);
    } catch (error) {
        console.error('[Auth] OAuth callback failed:', error);
        return c.json({ error: 'Authentication failed' }, 500);
    }
});

authRoutes.get('/me', requireAuth, (c) => {
    const session = c.get('session');
    return c.json({
        user: {
            id: session.discordUserId,
            username: session.username,
            avatar: session.avatar,
        },
        guilds: session.guilds,
    });
});

authRoutes.post('/logout', (c) => {
    deleteCookie(c, SESSION_COOKIE, { path: '/' });
    return c.json({ ok: true });
});


