import { sign, verify } from 'hono/jwt';
import { env } from '../config/env.js';

export const SESSION_COOKIE = 'sakutina_session';
const SESSION_TTL_SECONDS = 60 * 60; // 1h â€” re-login required after expiry (no refresh token stored)

export interface SessionGuild {
    id: string;
    name: string;
    icon: string | null;
    hasAccess: boolean;
}

export interface SessionData {
    discordUserId: string;
    username: string;
    avatar: string | null;
    guilds: SessionGuild[];
}

export interface SessionPayload extends SessionData {
    iat: number;
    exp: number;
}

export async function createSessionToken(
    payload: SessionData
): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const fullPayload: SessionPayload = {
        ...payload,
        iat: now,
        exp: now + SESSION_TTL_SECONDS,
    };
    return sign({ ...fullPayload }, env.SESSION_SECRET);
}

export async function verifySessionToken(
    token: string
): Promise<SessionPayload | null> {
    try {
        const payload = await verify(token, env.SESSION_SECRET, 'HS256');
        return payload as unknown as SessionPayload;
    } catch {
        return null;
    }
}
