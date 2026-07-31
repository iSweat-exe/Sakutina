import postgres from 'postgres';
import { env } from '../src/config/env.js';

const sql = postgres(env.DATABASE_URL, { max: 1 });

console.log(
    'columns',
    await sql`
        select table_name, column_name, column_default, is_nullable
        from information_schema.columns
        where table_schema = current_schema()
            and table_name in ('users', 'transactions', 'user_quests', 'interaction_stats')
            and column_name = 'guild_id'
        order by table_name
    `
);

console.log(
    'indexes',
    await sql`
        select tablename, indexname, indexdef
        from pg_indexes
        where schemaname = current_schema()
            and tablename in ('users', 'interaction_stats')
        order by tablename, indexname
    `
);

console.log(
    'users_by_guild',
    await sql`
        select
            guild_id,
            count(*)::int as count,
            coalesce(sum(balance), 0)::int as total_balance,
            coalesce(sum(bank), 0)::int as total_bank
        from users
        group by guild_id
        order by count desc
        limit 20
    `
);

console.log(
    'all_users',
    await sql`
        select id, discord_id, guild_id, balance, bank, daily_last_claim, current_job, created_at, updated_at
        from users
        order by id
        limit 50
    `
);

console.log(
    'multi_context_users',
    await sql`
        select
            discord_id,
            count(*)::int as contexts,
            array_agg(guild_id order by guild_id) as guilds,
            array_agg(balance order by guild_id) as balances,
            array_agg(bank order by guild_id) as banks
        from users
        group by discord_id
        having count(*) > 1
        order by contexts desc
        limit 20
    `
);

console.log(
    'user_table_meta',
    await sql`
        select c.relkind, c.relname
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = current_schema()
            and c.relname = 'users'
    `
);

console.log(
    'user_triggers',
    await sql`
        select trigger_name, action_timing, event_manipulation, action_statement
        from information_schema.triggers
        where event_object_schema = current_schema()
            and event_object_table = 'users'
        order by trigger_name
    `
);

console.log(
    'recent_transactions',
    await sql`
        select user_id, guild_id, type, amount, created_at
        from transactions
        order by created_at desc
        limit 20
    `
);

await sql.end();
