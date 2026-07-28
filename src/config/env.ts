import { config } from 'dotenv';

// Load .env depending on the current environment variables set by cross-env (if any)
const envFile =
    process.env.NODE_ENV === 'production'
        ? '.env.production.local'
        : '.env.local';
config({ path: [envFile, '.env.local', '.env'] });

interface EnvConfig {
    DISCORD_TOKEN: string;
    CLIENT_ID: string;
    NODE_ENV: 'development' | 'production';
    DATABASE_URL: string;
    DEVELOPER_ID: string[];
}

const parseEnv = (): EnvConfig => {
    const { DISCORD_TOKEN, CLIENT_ID, NODE_ENV, DATABASE_URL } = process.env;
    const validEnvs = ['development', 'production', 'test'] as const;

    if (!DISCORD_TOKEN)
        throw new Error('CRITICAL: DISCORD_TOKEN is missing in env');
    if (!CLIENT_ID) throw new Error('CRITICAL: CLIENT_ID is missing in env');
    if (!DATABASE_URL)
        throw new Error('CRITICAL: DATABASE_URL is missing in env');
    if (!process.env.DEVELOPER_ID)
        throw new Error('CRITICAL: DEVELOPER_ID is missing in env');
    if (process.env.NODE_ENV && !validEnvs.includes(process.env.NODE_ENV as any)) {
        throw new Error(`NODE_ENV invalide: ${process.env.NODE_ENV}`);
    }

    return {
        DISCORD_TOKEN,
        CLIENT_ID,
        DATABASE_URL,
        DEVELOPER_ID: process.env.DEVELOPER_ID.split(',').map((id) =>
            id.trim()
        ),
        NODE_ENV: (NODE_ENV as 'development' | 'production') || 'development',
    };
};

export const env = parseEnv();
