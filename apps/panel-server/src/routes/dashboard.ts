import { Hono } from 'hono';
import { db, users, warns, modActions, interactionStats } from '@sakutina/db';
import { count, desc, eq, sum } from 'drizzle-orm';
import { requireAuth, requireGuildAccess } from '../auth/middleware.js';
import { fetchGuildMemberCount, fetchGuildMembers } from '../discord/rest.js';
import { getGuildId } from '../utils/params.js';
import type { AppEnv } from '../types.js';

export const dashboardRoutes = new Hono<AppEnv>();

dashboardRoutes.use('*', requireAuth, requireGuildAccess);

dashboardRoutes.get('/overview', async (c) => {
    const guildId = getGuildId(c);

    const [
        memberCount,
        trackedUsersRows,
        warnRows,
        actionRows,
        interactionRows,
        recentActionRows,
        topUsers,
    ] = await Promise.all([
        fetchGuildMemberCount(guildId),
        db
            .select({ trackedUsers: count() })
            .from(users)
            .where(eq(users.guildId, guildId)),
        db
            .select({ warnCount: count() })
            .from(warns)
            .where(eq(warns.guildId, guildId)),
        db
            .select({ actionCount: count() })
            .from(modActions)
            .where(eq(modActions.guildId, guildId)),
        db
            .select({ interactionsTotal: sum(interactionStats.count) })
            .from(interactionStats)
            .where(eq(interactionStats.guildId, guildId)),
        db
            .select()
            .from(modActions)
            .where(eq(modActions.guildId, guildId))
            .orderBy(desc(modActions.createdAt))
            .limit(5),
        db
            .select({
                discordId: users.discordId,
                balance: users.balance,
            })
            .from(users)
            .where(eq(users.guildId, guildId))
            .orderBy(desc(users.balance))
            .limit(3),
    ]);

    const memberIds = [
        ...recentActionRows.map((a) => a.userId),
        ...topUsers.map((u) => u.discordId),
    ];
    const members = await fetchGuildMembers(guildId, memberIds);

    return c.json({
        memberCount,
        trackedUsers: trackedUsersRows[0]?.trackedUsers ?? 0,
        warnCount: warnRows[0]?.warnCount ?? 0,
        actionCount: actionRows[0]?.actionCount ?? 0,
        interactionsTotal: Number(interactionRows[0]?.interactionsTotal ?? 0),
        recentActions: recentActionRows.map((action) => ({
            ...action,
            member: members.get(action.userId) ?? null,
        })),
        topUsers: topUsers.map((u) => ({
            ...u,
            member: members.get(u.discordId) ?? null,
        })),
    });
});
