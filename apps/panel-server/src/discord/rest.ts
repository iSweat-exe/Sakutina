import { REST, Routes } from 'discord.js';
import { env } from '../config/env.js';

/**
 * Bot-authenticated REST client. Used for moderation quick actions and guild
 * metadata lookups â€” panel-server has no gateway connection, so it acts
 * purely over REST with the same bot token as apps/bot.
 */
export const botRest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);

export interface GuildMemberInfo {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string;
}

interface RawGuildMember {
    nick: string | null;
    user: {
        username: string;
        global_name: string | null;
        avatar: string | null;
    };
}

const memberCache = new Map<
    string,
    { data: GuildMemberInfo | null; expiresAt: number }
>();
const MEMBER_CACHE_TTL_MS = 60 * 1000;

function defaultAvatarUrl(userId: string): string {
    const index = Number(BigInt(userId) >> 22n) % 6;
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

/**
 * Resolves a single guild member's username/nickname/avatar via the
 * single-member REST endpoint (unlike the bulk "list guild members"
 * endpoint, this one does NOT require the privileged GUILD_MEMBERS intent),
 * with a short in-memory cache since the same IDs get looked up repeatedly
 * across dashboard/economy/moderation views.
 */
export async function fetchGuildMember(
    guildId: string,
    userId: string
): Promise<GuildMemberInfo | null> {
    const cacheKey = `${guildId}:${userId}`;
    const cached = memberCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    let data: GuildMemberInfo | null;
    try {
        const member = (await botRest.get(
            Routes.guildMember(guildId, userId)
        )) as RawGuildMember;
        const avatarUrl = member.user.avatar
            ? `https://cdn.discordapp.com/avatars/${userId}/${member.user.avatar}.png?size=64`
            : defaultAvatarUrl(userId);

        data = {
            id: userId,
            username: member.user.username,
            displayName: member.nick ?? member.user.global_name ?? member.user.username,
            avatarUrl,
        };
    } catch {
        // Member left the guild, or the ID is invalid â€” fall back to a
        // minimal shell so the UI can still render something for them.
        data = {
            id: userId,
            username: userId,
            displayName: userId,
            avatarUrl: defaultAvatarUrl(userId),
        };
    }

    memberCache.set(cacheKey, { data, expiresAt: Date.now() + MEMBER_CACHE_TTL_MS });
    return data;
}

/** Resolves multiple members in parallel, deduping repeated IDs. */
export async function fetchGuildMembers(
    guildId: string,
    userIds: string[]
): Promise<Map<string, GuildMemberInfo>> {
    const uniqueIds = [...new Set(userIds)];
    const results = await Promise.all(
        uniqueIds.map((id) => fetchGuildMember(guildId, id))
    );

    const map = new Map<string, GuildMemberInfo>();
    uniqueIds.forEach((id, i) => {
        const member = results[i];
        if (member) map.set(id, member);
    });
    return map;
}

export async function fetchGuildMemberCount(
    guildId: string
): Promise<number | null> {
    try {
        const guild = (await botRest.get(Routes.guild(guildId), {
            query: new URLSearchParams({ with_counts: 'true' }),
        })) as { approximate_member_count?: number };
        return guild.approximate_member_count ?? null;
    } catch {
        return null;
    }
}

export interface GuildChannelInfo {
    id: string;
    name: string;
    type: number;
}

const channelsCache = new Map<
    string,
    { data: GuildChannelInfo[]; expiresAt: number }
>();
const CHANNELS_CACHE_TTL_MS = 60 * 1000;

/**
 * Resolves a guild's channel list (id/name/type) so activity stats keyed by
 * channel ID can be rendered with human-readable names in the panel.
 */
export async function fetchGuildChannels(
    guildId: string
): Promise<GuildChannelInfo[]> {
    const cached = channelsCache.get(guildId);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    let data: GuildChannelInfo[];
    try {
        const channels = (await botRest.get(
            Routes.guildChannels(guildId)
        )) as Array<{ id: string; name: string; type: number }>;
        data = channels.map((ch) => ({
            id: ch.id,
            name: ch.name,
            type: ch.type,
        }));
    } catch {
        data = [];
    }

    channelsCache.set(guildId, {
        data,
        expiresAt: Date.now() + CHANNELS_CACHE_TTL_MS,
    });
    return data;
}

export async function banGuildMember(
    guildId: string,
    userId: string,
    reason: string
): Promise<void> {
    await botRest.put(Routes.guildBan(guildId, userId), {
        reason,
        body: {},
    });
}

export async function kickGuildMember(
    guildId: string,
    userId: string,
    reason: string
): Promise<void> {
    await botRest.delete(Routes.guildMember(guildId, userId), { reason });
}

/** Times out (mutes) a member for the given number of minutes. */
export async function timeoutGuildMember(
    guildId: string,
    userId: string,
    reason: string,
    durationMinutes: number
): Promise<void> {
    const communicationDisabledUntil = new Date(
        Date.now() + durationMinutes * 60 * 1000
    ).toISOString();

    await botRest.patch(Routes.guildMember(guildId, userId), {
        reason,
        body: { communication_disabled_until: communicationDisabledUntil },
    });
}


