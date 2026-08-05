import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';

// This package has no app of its own, so it loads env vars directly.
// Falls back to apps/bot's env files since they hold the same DATABASE_URL
// used by the whole workspace (single shared Postgres instance).
config({
    path: [
        '.env.local',
        '.env',
        '../../apps/bot/.env.local',
        '../../apps/bot/.env.production.local',
    ],
});

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('CRITICAL: DATABASE_URL is missing in env');

export default defineConfig({
    dialect: 'postgresql',
    schema: './src/schema.ts',
    out: './drizzle',
    dbCredentials: {
        url: databaseUrl,
    },
    verbose: true,
    strict: true,
});
