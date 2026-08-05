import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('CRITICAL: DATABASE_URL is missing in env');

// Connection pool
const queryClient = postgres(databaseUrl, { max: 10 }); //TODO: Configure with ENV variables
export const db = drizzle(queryClient, { schema });

// Test database connection
export const checkDbConnection = async () => {
    try {
        await queryClient`SELECT 1`;
        console.log('[Database] Connection successfully established!');
    } catch (error) {
        console.error('[Database] Database connection failed:', error);
        throw error;
    }
};

// Close the connection explicitly
export const closeDb = async () => {
    await queryClient.end();
};
