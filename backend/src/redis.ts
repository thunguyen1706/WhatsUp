import { Redis } from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  reconnectOnError(err) {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      return true;
    }
    return false;
  },
});

redis.on('connect', () => {
  console.log('Connected to Redis');
});

redis.on('error', (err) => {
  console.error('Redis Client Error', err);
});

// Cache utilities
export const cache = {
  async get(key: string): Promise<any> {
    try {
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  },

  async set(key: string, value: any, ttlSeconds = 3600): Promise<void> {
    try {
      await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error) {
      console.error('Cache set error:', error);
    }
  },

  async del(key: string | string[]): Promise<void> {
    try {
      if (Array.isArray(key)) {
        await redis.del(...key);
      } else {
        await redis.del(key);
      }
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  },

  async flush(): Promise<void> {
    try {
      await redis.flushall();
    } catch (error) {
      console.error('Cache flush error:', error);
    }
  },
};

export default redis;