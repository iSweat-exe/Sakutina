import { beforeAll, describe, expect, test } from 'bun:test';
import { Hono } from 'hono';

process.env.DATABASE_URL ??= 'postgres://test';
process.env.DISCORD_TOKEN ??= 'test-token';
process.env.CLIENT_ID ??= 'test-client-id';
process.env.CLIENT_SECRET ??= 'test-client-secret';
process.env.DISCORD_REDIRECT_URI ??= 'http://localhost/callback';
process.env.SESSION_SECRET ??= 'test-session-secret';
process.env.PANEL_CLIENT_ORIGIN ??= 'http://localhost:5173';

let requireAuth: typeof import('./middleware.js').requireAuth;
let requireGuildAccess: typeof import('./middleware.js').requireGuildAccess;
let requireGuildMember: typeof import('./middleware.js').requireGuildMember;
let createSessionToken: typeof import('./session.js').createSessionToken;
let SESSION_COOKIE: typeof import('./session.js').SESSION_COOKIE;

beforeAll(async () => {
    ({ requireAuth, requireGuildAccess, requireGuildMember } =
        await import('./middleware.js'));
    ({ createSessionToken, SESSION_COOKIE } = await import('./session.js'));
});

function buildApp() {
    const app = new Hono();
    app.get('/protected', requireAuth, (c) =>
        c.json({ session: c.get('session').discordUserId })
    );
    app.get('/guilds/:guildId/admin', requireAuth, requireGuildAccess, (c) =>
        c.json({ ok: true })
    );
    app.get('/guilds/:guildId/member', requireAuth, requireGuildMember, (c) =>
        c.json({ ok: true })
    );
    return app;
}

async function json(res: Response): Promise<Record<string, unknown>> {
    return (await res.json()) as Record<string, unknown>;
}

async function tokenFor(guilds: Array<{ id: string; hasAccess: boolean }>) {
    return createSessionToken({
        discordUserId: 'u1',
        username: 'tester',
        avatar: null,
        guilds: guilds.map((g) => ({ ...g, name: 'g', icon: null })),
    });
}

describe('requireAuth', () => {
    test('rejects a request with no session cookie', async () => {
        const res = await buildApp().request('/protected');
        expect(res.status).toBe(401);
        expect((await json(res)).error).toBe('Not authenticated');
    });

    test('rejects a request with an invalid session cookie', async () => {
        const res = await buildApp().request('/protected', {
            headers: { Cookie: `${SESSION_COOKIE}=garbage` },
        });
        expect(res.status).toBe(401);
        expect((await json(res)).error).toBe('Session expired or invalid');
    });

    test('accepts a request with a valid session cookie and attaches it', async () => {
        const token = await tokenFor([]);
        const res = await buildApp().request('/protected', {
            headers: { Cookie: `${SESSION_COOKIE}=${token}` },
        });
        expect(res.status).toBe(200);
        expect((await json(res)).session).toBe('u1');
    });
});

describe('requireGuildAccess', () => {
    test('403s when the user has no membership in the guild', async () => {
        const token = await tokenFor([{ id: 'other', hasAccess: true }]);
        const res = await buildApp().request('/guilds/g1/admin', {
            headers: { Cookie: `${SESSION_COOKIE}=${token}` },
        });
        expect(res.status).toBe(403);
    });

    test('403s when the user is a member but lacks admin access', async () => {
        const token = await tokenFor([{ id: 'g1', hasAccess: false }]);
        const res = await buildApp().request('/guilds/g1/admin', {
            headers: { Cookie: `${SESSION_COOKIE}=${token}` },
        });
        expect(res.status).toBe(403);
    });

    test('200s when the user has admin access to the guild', async () => {
        const token = await tokenFor([{ id: 'g1', hasAccess: true }]);
        const res = await buildApp().request('/guilds/g1/admin', {
            headers: { Cookie: `${SESSION_COOKIE}=${token}` },
        });
        expect(res.status).toBe(200);
    });
});

describe('requireGuildMember', () => {
    test('403s when the user does not share the guild at all', async () => {
        const token = await tokenFor([{ id: 'other', hasAccess: false }]);
        const res = await buildApp().request('/guilds/g1/member', {
            headers: { Cookie: `${SESSION_COOKIE}=${token}` },
        });
        expect(res.status).toBe(403);
    });

    test('200s for a plain member even without admin access', async () => {
        const token = await tokenFor([{ id: 'g1', hasAccess: false }]);
        const res = await buildApp().request('/guilds/g1/member', {
            headers: { Cookie: `${SESSION_COOKIE}=${token}` },
        });
        expect(res.status).toBe(200);
    });
});
