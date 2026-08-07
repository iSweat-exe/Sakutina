import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import type { AppEnv } from '../types.js';

/**
 * Hono's param-type inference doesn't flow the `:guildId` segment declared
 * on the *mount* prefix (`app.route('/api/guilds/:guildId/...', subApp)`)
 * into the mounted sub-router's own context type — it only tracks params
 * declared on routes registered directly on that router. The param is still
 * populated correctly at runtime (Hono resolves it from the merged pattern).
 *
 * `bindGuildId` re-reads it once and stores it as a typed context variable,
 * so every route handler downstream can read `c.get('guildId')` (or call
 * `getGuildId(c)`) without repeating the untyped extraction.
 */
export const bindGuildId = createMiddleware<AppEnv>(async (c, next) => {
    c.set('guildId', c.req.param('guildId') as string);
    await next();
});

export function getGuildId(c: Context<AppEnv>): string {
    return c.get('guildId');
}
