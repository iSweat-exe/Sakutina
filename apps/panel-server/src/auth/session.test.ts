import { beforeAll, describe, expect, test } from 'bun:test';

// config/env.ts (imported transitively by session.ts) throws at import time
// if required vars are missing, and reads process.env eagerly on import —
// so the required vars are seeded and the module graph is loaded via a
// dynamic import *after* that, rather than a static top-level import.
process.env.DATABASE_URL ??= 'postgres://test';
process.env.DISCORD_TOKEN ??= 'test-token';
process.env.CLIENT_ID ??= 'test-client-id';
process.env.CLIENT_SECRET ??= 'test-client-secret';
process.env.DISCORD_REDIRECT_URI ??= 'http://localhost/callback';
process.env.SESSION_SECRET ??= 'test-session-secret';
process.env.PANEL_CLIENT_ORIGIN ??= 'http://localhost:5173';

let createSessionToken: typeof import('./session.js').createSessionToken;
let verifySessionToken: typeof import('./session.js').verifySessionToken;
let sign: typeof import('hono/jwt').sign;

const basePayload = {
    discordUserId: '1234567890',
    username: 'test-user',
    avatar: null,
    guilds: [{ id: '1', name: 'Guild', icon: null, hasAccess: true }],
};

beforeAll(async () => {
    ({ createSessionToken, verifySessionToken } = await import('./session.js'));
    ({ sign } = await import('hono/jwt'));
});

describe('createSessionToken / verifySessionToken', () => {
    test('round-trips a payload through sign and verify', async () => {
        const token = await createSessionToken(basePayload);
        const decoded = await verifySessionToken(token);
        expect(decoded).not.toBeNull();
        expect(decoded?.discordUserId).toBe('1234567890');
        expect(decoded?.username).toBe('test-user');
        expect(decoded?.guilds).toEqual(basePayload.guilds);
    });

    test('sets iat/exp roughly one hour apart', async () => {
        const token = await createSessionToken(basePayload);
        const decoded = await verifySessionToken(token);
        expect(decoded!.exp - decoded!.iat).toBe(60 * 60);
    });

    test('returns null for a garbage token', async () => {
        expect(await verifySessionToken('not-a-jwt')).toBeNull();
    });

    test('returns null for a token signed with the wrong secret', async () => {
        const token = await sign(
            {
                ...basePayload,
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + 3600,
            },
            'a-completely-different-secret'
        );
        expect(await verifySessionToken(token)).toBeNull();
    });

    test('returns null for an expired token', async () => {
        const now = Math.floor(Date.now() / 1000);
        const expired = await sign(
            { ...basePayload, iat: now - 7200, exp: now - 3600 },
            process.env.SESSION_SECRET!
        );
        expect(await verifySessionToken(expired)).toBeNull();
    });

    test('returns null for a tampered payload', async () => {
        const token = await createSessionToken(basePayload);
        const [header, , signature] = token.split('.');
        const tamperedPayload = Buffer.from(
            JSON.stringify({ ...basePayload, discordUserId: 'attacker' })
        ).toString('base64url');
        expect(
            await verifySessionToken(
                `${header}.${tamperedPayload}.${signature}`
            )
        ).toBeNull();
    });
});
