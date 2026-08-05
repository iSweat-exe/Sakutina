import { config } from 'dotenv';

const envFile =
    process.env.NODE_ENV === 'production'
        ? '.env.production.local'
        : '.env.local';
config({ path: [envFile, '.env.local', '.env'] });

interface EnvConfig {
    PORT: number;
    NODE_ENV: 'development' | 'production' | 'test';
    DATABASE_URL: string;
    REDIS_URL: string;
    DISCORD_TOKEN: string;
    CLIENT_ID: string;
    CLIENT_SECRET: string;
    DISCORD_REDIRECT_URI: string;
    SESSION_SECRET: string;
    PANEL_CLIENT_ORIGIN: string;
}

const parseEnv = (): EnvConfig => {
    const {
        PORT,
        NODE_ENV,
        DATABASE_URL,
        REDIS_URL,
        DISCORD_TOKEN,
        CLIENT_ID,
        CLIENT_SECRET,
        DISCORD_REDIRECT_URI,
        SESSION_SECRET,
        PANEL_CLIENT_ORIGIN,
    } = process.env;

    const validEnvs = ['development', 'production', 'test'] as const;

    if (!DATABASE_URL)
        throw new Error('CRITICAL: DATABASE_URL is missing in env');
    if (!DISCORD_TOKEN)
        throw new Error('CRITICAL: DISCORD_TOKEN is missing in env');
    if (!CLIENT_ID) throw new Error('CRITICAL: CLIENT_ID is missing in env');
    if (!CLIENT_SECRET)
        throw new Error('CRITICAL: CLIENT_SECRET is missing in env');
    if (!DISCORD_REDIRECT_URI)
        throw new Error('CRITICAL: DISCORD_REDIRECT_URI is missing in env');
    if (!SESSION_SECRET)
        throw new Error('CRITICAL: SESSION_SECRET is missing in env');
    if (!PANEL_CLIENT_ORIGIN)
        throw new Error('CRITICAL: PANEL_CLIENT_ORIGIN is missing in env');
    if (NODE_ENV && !validEnvs.includes(NODE_ENV as any)) {
        throw new Error(`NODE_ENV invalide: ${NODE_ENV}`);
    }

    // Re-exposed via process.env so @sakutina/cache (which reads it directly)
    // sees the same default as the rest of this app.
    const resolvedRedisUrl = REDIS_URL || 'redis://localhost:6379';
    process.env.REDIS_URL = resolvedRedisUrl;

    return {
        PORT: PORT ? Number(PORT) : 4000,
        NODE_ENV: (NODE_ENV as EnvConfig['NODE_ENV']) || 'development',
        DATABASE_URL,
        REDIS_URL: resolvedRedisUrl,
        DISCORD_TOKEN,
        CLIENT_ID,
        CLIENT_SECRET,
        DISCORD_REDIRECT_URI,
        SESSION_SECRET,
        PANEL_CLIENT_ORIGIN,
    };
};

export const env = parseEnv();
