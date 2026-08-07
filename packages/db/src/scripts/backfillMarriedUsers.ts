/**
 * One-time backfill to run AFTER applying the migration that creates
 * `married_users`. Existing `marriages` rows predate that table, so this
 * populates one `married_users` row per spouse from the current
 * `marriages` data. Run `dedupeMarriages.ts` first if it hasn't already
 * been run, since a duplicate marriage would violate the new unique
 * constraint on `married_users.user_id`.
 *
 * Usage: bun run packages/db/src/scripts/backfillMarriedUsers.ts
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

const { db, marriages, marriedUsers } = await import('../index.js');

const rows = await db.select().from(marriages);

const values = rows.flatMap((row) => [
    { userId: row.user1Id, marriageId: row.id },
    { userId: row.user2Id, marriageId: row.id },
]);

if (values.length === 0) {
    console.log('[backfillMarriedUsers] No marriages found — nothing to do.');
} else {
    const inserted = await db
        .insert(marriedUsers)
        .values(values)
        .onConflictDoNothing()
        .returning();
    console.log(
        `[backfillMarriedUsers] Inserted ${inserted.length}/${values.length} married_users row(s) from ${rows.length} marriage(s).`
    );
}

process.exit(0);
