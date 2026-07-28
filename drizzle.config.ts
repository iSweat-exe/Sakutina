import { defineConfig } from 'drizzle-kit';
import { env } from './src/config/env.js'; // This will use your parsed env config

export default defineConfig({
    dialect: 'postgresql',
    schema: './src/repositories/schema.ts',
    out: './drizzle',
    dbCredentials: {
        url: env.DATABASE_URL,
    },
    verbose: true,
    strict: true,
});
