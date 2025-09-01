import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export class CacheService {
  /**
   * Get cached value
   */
  static async get(key: string): Promise<any> {
    try {
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set cache value
   */
  static async set(key: string, value: any, ttlSeconds = 3600): Promise<void> {
    try {
      await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error) {
      console.error('Cache set error:', error);
  }
  }

  /**
   * Delete cache keys
   */
  static async del(keys: string | string[]): Promise<void> {
    try {
      if (Array.isArray(keys)) {
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } else {
        await redis.del(keys);
      }
    } catch (error) {
      console.error('Cache delete error:', error);
  }
  }

  /**
   * Invalidate cache by pattern
   */
  static async invalidatePattern(pattern: string): Promise<void> {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      console.error('Cache invalidate pattern error:', error);
    }
  }

  /**
   * Flush all cache
   */
  static async flush(): Promise<void> {
    try {
      await redis.flushall();
    } catch (error) {
      console.error('Cache flush error:', error);
    }
  }

  /**
   * Generate cache key
   */
  static generateKey(prefix: string, params: any): string {
    const sortedParams = Object.keys(params)
      .sort()
      .filter(k => params[k] !== undefined)
      .map(k => `${k}:${params[k]}`)
      .join(':');
    return `${prefix}:${sortedParams}`;
  }

  /**
   * Get Redis info
   */
  static async info(): Promise<string> {
    return await redis.info();
  }

  /**
   * Get all keys matching pattern
   */
  static async keys(pattern: string): Promise<string[]> {
    return await redis.keys(pattern);
  }
}