import { Hono } from 'hono';
import {
    db,
    users,
    transactions,
    userInventory,
    marriages,
} from '@sakutina/db';
import { and, desc, eq, or } from 'drizzle-orm';
import { requireAuth, requireGuildAccess } from '../auth/middleware.js';
import { fetchGuildMember, fetchGuildMembers } from '../discord/rest.js';
import { getGuildId } from '../utils/params.js';
import type { AppEnv } from '../types.js';

export const economyRoutes = new Hono<AppEnv>();

economyRoutes.use('*', requireAuth, requireGuildAccess);

const SORTABLE_COLUMNS = {
    balance: users.balance,
    bank: users.bank,
    experience: users.experience,
} as const;
type SortKey = keyof typeof SORTABLE_COLUMNS;

economyRoutes.get('/users', async (c) => {
    const guildId = getGuildId(c);
    const sortParam = c.req.query('sort') as SortKey | undefined;
    const sortColumn =
        sortParam && sortParam in SORTABLE_COLUMNS
            ? SORTABLE_COLUMNS[sortParam]
            : users.balance;
    const limit = Math.min(Number(c.req.query('limit')) || 50, 100);

    const rows = await db
        .select()
        .from(users)
        .where(eq(users.guildId, guildId))
        .orderBy(desc(sortColumn))
        .limit(limit);

    const members = await fetchGuildMembers(
        guildId,
        rows.map((r) => r.discordId)
    );

    return c.json(
        rows.map((row) => ({
            ...row,
            member: members.get(row.discordId) ?? null,
        }))
    );
});

economyRoutes.get('/users/:userId', async (c) => {
    const guildId = getGuildId(c);
    const userId = c.req.param('userId');

    const [profile, marriage] = await Promise.all([
        db
            .select()
            .from(users)
            .where(and(eq(users.discordId, userId), eq(users.guildId, guildId)))
            .then((res) => res[0]),
        db
            .select()
            .from(marriages)
            .where(
                or(eq(marriages.user1Id, userId), eq(marriages.user2Id, userId))
            )
            .then((res) => res[0] ?? null),
    ]);

    if (!profile) return c.json({ error: 'User not found' }, 404);

    const member = await fetchGuildMember(guildId, userId);

    return c.json({ ...profile, marriage, member });
});

economyRoutes.get('/users/:userId/transactions', async (c) => {
    const guildId = getGuildId(c);
    const userId = c.req.param('userId');

    const rows = await db
        .select()
        .from(transactions)
        .where(
            and(
                eq(transactions.guildId, guildId),
                eq(transactions.userId, userId)
            )
        )
        .orderBy(desc(transactions.createdAt))
        .limit(50);

    return c.json(rows);
});

economyRoutes.get('/users/:userId/inventory', async (c) => {
    const guildId = getGuildId(c);
    const userId = c.req.param('userId');

    const rows = await db
        .select()
        .from(userInventory)
        .where(
            and(
                eq(userInventory.guildId, guildId),
                eq(userInventory.discordId, userId)
            )
        );

    return c.json(rows);
});
