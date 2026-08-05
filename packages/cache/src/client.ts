import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) throw new Error('CRITICAL: REDIS_URL is missing in env');

export const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
});

redis.on('error', (error) => {
    console.error('[Redis] Connection error:', error);
});

export const checkRedisConnection = async () => {
    try {
        await redis.ping();
        console.log('[Redis] Connection successfully established!');
    } catch (error) {
        console.error('[Redis] Connection failed:', error);
        throw error;
    }
};

export const closeRedis = async () => {
    await redis.quit();
};
