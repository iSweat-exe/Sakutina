import { createMiddleware } from 'hono/factory';
import { getCookie } from 'hono/cookie';
import { SESSION_COOKIE, verifySessionToken } from './session.js';
import { getGuildId } from '../utils/params.js';
import type { AppEnv } from '../types.js';

/** Requires a valid session cookie; attaches the decoded session to context. */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
    const token = getCookie(c, SESSION_COOKIE);
    if (!token) return c.json({ error: 'Not authenticated' }, 401);

    const session = await verifySessionToken(token);
    if (!session) return c.json({ error: 'Session expired or invalid' }, 401);

    c.set('session', session);
    await next();
});

/**
 * Requires the authenticated user to have Admin/Manage Guild access on the
 * `:guildId` route param, based on the permission snapshot taken at login.
 * This snapshot can be up to the session TTL stale if a role is revoked
 * mid-session â€” acceptable for an internal admin tool at MVP scope.
 */
export const requireGuildAccess = createMiddleware<AppEnv>(async (c, next) => {
    const guildId = getGuildId(c);
    const session = c.get('session');

    const guild = session.guilds.find((g) => g.id === guildId);
    if (!guild || !guild.hasAccess) {
        return c.json({ error: 'Forbidden: no access to this guild' }, 403);
    }

    await next();
});


