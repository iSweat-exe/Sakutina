import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../config/env.js';
import * as schema from './schema.js';
import { logger } from '../utils/logger.js';

// Connection pool
const queryClient = postgres(env.DATABASE_URL, { max: 10 }); //TODO: Configure with ENV variables
export const db = drizzle(queryClient, { schema });

// Test database connection
export const checkDbConnection = async () => {
    try {
        await queryClient`SELECT 1`;
        logger.info('[Database] Connection successfully established!');
    } catch (error) {
        logger.error('[Database] Database connection failed:', error);
        throw error;
    }
};

// Close the connection explicitly
export const closeDb = async () => {
    await queryClient.end();
};
