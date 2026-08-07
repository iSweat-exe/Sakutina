import { Hono, type Context } from 'hono';
import { db, warns, modActions } from '@sakutina/db';
import { and, desc, eq } from 'drizzle-orm';
import { requireAuth, requireGuildAccess } from '../auth/middleware.js';
import {
    banGuildMember,
    fetchGuildMembers,
    kickGuildMember,
    searchGuildMembers,
    timeoutGuildMember,
} from '../discord/rest.js';
import { bindGuildId, getGuildId } from '../utils/params.js';
import {
    isNonEmptyString,
    isPositiveInteger,
    parseJsonBody,
} from '../utils/validate.js';
import type { AppEnv } from '../types.js';

export const moderationRoutes = new Hono<AppEnv>();

moderationRoutes.use('*', bindGuildId, requireAuth, requireGuildAccess);

moderationRoutes.get('/warns', async (c) => {
    const guildId = getGuildId(c);
    const userId = c.req.query('userId');

    const rows = await db
        .select()
        .from(warns)
        .where(
            userId
                ? and(eq(warns.guildId, guildId), eq(warns.userId, userId))
                : eq(warns.guildId, guildId)
        )
        .orderBy(desc(warns.createdAt))
        .limit(100);

    const members = await fetchGuildMembers(
        guildId,
        rows.map((r) => r.userId)
    );

    return c.json(
        rows.map((row) => ({ ...row, member: members.get(row.userId) ?? null }))
    );
});

moderationRoutes.get('/search-members', async (c) => {
    const guildId = getGuildId(c);
    const query = c.req.query('query') ?? '';

    const results = await searchGuildMembers(guildId, query);
    return c.json(results);
});

moderationRoutes.get('/actions', async (c) => {
    const guildId = getGuildId(c);
    const userId = c.req.query('userId');

    const rows = await db
        .select()
        .from(modActions)
        .where(
            userId
                ? and(
                      eq(modActions.guildId, guildId),
                      eq(modActions.userId, userId)
                  )
                : eq(modActions.guildId, guildId)
        )
        .orderBy(desc(modActions.createdAt))
        .limit(100);

    const members = await fetchGuildMembers(
        guildId,
        rows.map((r) => r.userId)
    );

    return c.json(
        rows.map((row) => ({ ...row, member: members.get(row.userId) ?? null }))
    );
});

interface ActionBody {
    userId: string;
    reason: string;
    durationMinutes?: number;
}

async function readActionBody(c: Context<AppEnv>): Promise<ActionBody | null> {
    const body = await parseJsonBody(c.req);
    if (!body || !isNonEmptyString(body.userId)) return null;
    if (
        body.durationMinutes !== undefined &&
        !isPositiveInteger(body.durationMinutes)
    )
        return null;
    return {
        userId: body.userId,
        reason: isNonEmptyString(body.reason)
            ? body.reason
            : 'No reason provided',
        durationMinutes: body.durationMinutes as number | undefined,
    };
}

moderationRoutes.post('/warn', async (c) => {
    const guildId = getGuildId(c);
    const session = c.get('session');
    const body = await readActionBody(c);
    if (!body) return c.json({ error: 'userId is required' }, 400);

    await db.insert(warns).values({
        guildId,
        userId: body.userId,
        moderatorId: session.discordUserId,
        reason: body.reason,
    });
    await db.insert(modActions).values({
        guildId,
        userId: body.userId,
        moderatorId: session.discordUserId,
        actionType: 'WARN',
        reason: body.reason,
    });

    return c.json({ ok: true });
});

moderationRoutes.post('/mute', async (c) => {
    const guildId = getGuildId(c);
    const session = c.get('session');
    const body = await readActionBody(c);
    if (!body) return c.json({ error: 'userId is required' }, 400);
    const durationMinutes = body.durationMinutes ?? 60;

    try {
        await timeoutGuildMember(
            guildId,
            body.userId,
            body.reason,
            durationMinutes
        );
    } catch {
        return c.json({ error: 'Failed to mute member on Discord' }, 502);
    }

    await db.insert(modActions).values({
        guildId,
        userId: body.userId,
        moderatorId: session.discordUserId,
        actionType: 'MUTE',
        reason: body.reason,
        expiresAt: new Date(Date.now() + durationMinutes * 60 * 1000),
    });

    return c.json({ ok: true });
});

moderationRoutes.post('/kick', async (c) => {
    const guildId = getGuildId(c);
    const session = c.get('session');
    const body = await readActionBody(c);
    if (!body) return c.json({ error: 'userId is required' }, 400);

    try {
        await kickGuildMember(guildId, body.userId, body.reason);
    } catch {
        return c.json({ error: 'Failed to kick member on Discord' }, 502);
    }

    await db.insert(modActions).values({
        guildId,
        userId: body.userId,
        moderatorId: session.discordUserId,
        actionType: 'KICK',
        reason: body.reason,
    });

    return c.json({ ok: true });
});

moderationRoutes.post('/ban', async (c) => {
    const guildId = getGuildId(c);
    const session = c.get('session');
    const body = await readActionBody(c);
    if (!body) return c.json({ error: 'userId is required' }, 400);

    try {
        await banGuildMember(guildId, body.userId, body.reason);
    } catch {
        return c.json({ error: 'Failed to ban member on Discord' }, 502);
    }

    await db.insert(modActions).values({
        guildId,
        userId: body.userId,
        moderatorId: session.discordUserId,
        actionType: 'BAN',
        reason: body.reason,
    });

    return c.json({ ok: true });
});
