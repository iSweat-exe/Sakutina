import type { Context } from 'hono';
import type { AppEnv } from '../types.js';

/**
 * Hono's param-type inference doesn't flow the `:guildId` segment declared
 * on the *mount* prefix (`app.route('/api/guilds/:guildId/...', subApp)`)
 * into the mounted sub-router's own context type â€” it only tracks params
 * declared on routes registered directly on that router. The param is still
 * populated correctly at runtime (Hono resolves it from the merged pattern);
 * this just narrows the type back to `string` for the handlers below.
 */
export function getGuildId(c: Context<AppEnv>): string {
    return c.req.param('guildId') as string;
}


