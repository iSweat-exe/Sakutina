import { env } from '../config/env.js';

const API_BASE = 'https://discord.com/api/v10';

export interface DiscordTokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token: string;
    scope: string;
}

export interface DiscordUser {
    id: string;
    username: string;
    global_name: string | null;
    avatar: string | null;
}

export interface DiscordUserGuild {
    id: string;
    name: string;
    icon: string | null;
    owner: boolean;
    permissions: string;
}

/** Administrator (0x8) or Manage Guild (0x20) */
const MANAGE_ACCESS_BITS = (1 << 3) | (1 << 5);

export function hasManageAccess(permissions: string): boolean {
    return (BigInt(permissions) & BigInt(MANAGE_ACCESS_BITS)) !== 0n;
}

export async function exchangeCodeForToken(
    code: string
): Promise<DiscordTokenResponse> {
    const body = new URLSearchParams({
        client_id: env.CLIENT_ID,
        client_secret: env.CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: env.DISCORD_REDIRECT_URI,
    });

    const res = await fetch(`${API_BASE}/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    });

    if (!res.ok) {
        throw new Error(`Discord token exchange failed: ${res.status}`);
    }
    return res.json() as Promise<DiscordTokenResponse>;
}

export async function fetchDiscordUser(
    accessToken: string
): Promise<DiscordUser> {
    const res = await fetch(`${API_BASE}/users/@me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Failed to fetch Discord user: ${res.status}`);
    return res.json() as Promise<DiscordUser>;
}

export async function fetchUserGuilds(
    accessToken: string
): Promise<DiscordUserGuild[]> {
    const res = await fetch(`${API_BASE}/users/@me/guilds`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok)
        throw new Error(`Failed to fetch user guilds: ${res.status}`);
    return res.json() as Promise<DiscordUserGuild[]>;
}

/** Guilds the bot itself is a member of, cached briefly to avoid rate limits. */
let botGuildsCache: { ids: Set<string>; expiresAt: number } | null = null;
const BOT_GUILDS_CACHE_TTL_MS = 60 * 1000;

export async function fetchBotGuildIds(): Promise<Set<string>> {
    if (botGuildsCache && botGuildsCache.expiresAt > Date.now()) {
        return botGuildsCache.ids;
    }

    const res = await fetch(`${API_BASE}/users/@me/guilds`, {
        headers: { Authorization: `Bot ${env.DISCORD_TOKEN}` },
    });
    if (!res.ok) throw new Error(`Failed to fetch bot guilds: ${res.status}`);
    const guilds = (await res.json()) as { id: string }[];
    const ids = new Set(guilds.map((g) => g.id));

    botGuildsCache = { ids, expiresAt: Date.now() + BOT_GUILDS_CACHE_TTL_MS };
    return ids;
}


