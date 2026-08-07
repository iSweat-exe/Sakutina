/**
 * One-time cleanup to run BEFORE applying the migration that drops
 * marriages.guild_id. Marriages used to be scoped per guild, so the same
 * user could technically be "married" in several guilds at once — going
 * global means each user can only keep one marriage. This keeps each
 * user's oldest marriage and deletes any others they're a party to.
 *
 * Usage: bun run packages/db/src/scripts/dedupeMarriages.ts
 */
import { config } from 'dotenv';

config({
    path: [
        '.env.local',
        '.env',
        '../../apps/bot/.env.local',
        '../../apps/bot/.env.production.local',
    ],
});

const { db, marriages } = await import('../index.js');
const { asc, inArray } = await import('drizzle-orm');

const rows = await db
    .select()
    .from(marriages)
    .orderBy(asc(marriages.marriedAt));

const claimed = new Set<string>();
const keepIds: number[] = [];
const dropIds: number[] = [];

for (const row of rows) {
    if (claimed.has(row.user1Id) || claimed.has(row.user2Id)) {
        dropIds.push(row.id);
        continue;
    }
    claimed.add(row.user1Id);
    claimed.add(row.user2Id);
    keepIds.push(row.id);
}

if (dropIds.length === 0) {
    console.log(
        `[dedupeMarriages] No conflicts found across ${rows.length} marriage row(s) — nothing to clean up.`
    );
} else {
    await db.delete(marriages).where(inArray(marriages.id, dropIds));
    console.log(
        `[dedupeMarriages] Kept ${keepIds.length} marriage(s), removed ${dropIds.length} conflicting duplicate(s) (same user married in multiple guilds).`
    );
}

process.exit(0);
