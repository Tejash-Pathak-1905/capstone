const { getRedisClient } = require('./index');

// In-memory fallback map if Redis is temporarily offline or in test environments
const memoryFallback = new Map();

/**
 * Cache-aside helper service supporting Redis with graceful in-memory fallback.
 */
class CacheService {
  constructor() {
    this.memoryCache = memoryFallback;
  }

  /**
   * Retrieves a cached value.
   * @param {string} key
   * @returns {Promise<any|null>}
   */
  async get(key) {
    try {
      const client = getRedisClient();
      if (client && client.status === 'ready') {
        const data = await client.get(key);
        return data ? JSON.parse(data) : null;
      }
    } catch (err) {
      // Degrade gracefully to in-memory fallback
    }

    // In-memory fallback
    const entry = this.memoryCache.get(key);
    if (entry) {
      if (Date.now() > entry.expiry) {
        this.memoryCache.delete(key);
        return null;
      }
      return entry.value;
    }

    return null;
  }

  /**
   * Sets a value in the cache with an expiration in seconds.
   * @param {string} key
   * @param {any} value
   * @param {number} ttlSeconds
   * @returns {Promise<boolean>}
   */
  async set(key, value, ttlSeconds = 300) {
    const stringified = JSON.stringify(value);

    try {
      const client = getRedisClient();
      if (client && client.status === 'ready') {
        await client.set(key, stringified, 'EX', ttlSeconds);
        return true;
      }
    } catch (err) {
      // Degrade gracefully
    }

    // In-memory fallback
    this.memoryCache.set(key, {
      value,
      expiry: Date.now() + ttlSeconds * 1000,
    });
    return true;
  }

  /**
   * Deletes a specific key from the cache.
   * @param {string} key
   * @returns {Promise<boolean>}
   */
  async del(key) {
    try {
      const client = getRedisClient();
      if (client && client.status === 'ready') {
        await client.del(key);
      }
    } catch (err) {
      // Degrade gracefully
    }
    this.memoryCache.delete(key);
    return true;
  }

  /**
   * Deletes keys matching a wildcard pattern (e.g. "discover:page:*").
   * @param {string} pattern
   * @returns {Promise<number>} Number of keys removed
   */
  async delPattern(pattern) {
    let count = 0;
    try {
      const client = getRedisClient();
      if (client && client.status === 'ready') {
        const keys = await client.keys(pattern);
        if (keys.length > 0) {
          count = await client.del(...keys);
        }
      }
    } catch (err) {
      // Degrade gracefully
    }

    // Clear matching memory fallback keys
    const regexPattern = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const k of this.memoryCache.keys()) {
      if (regexPattern.test(k)) {
        this.memoryCache.delete(k);
        count++;
      }
    }

    return count;
  }

  /**
   * Clears all cached items in fallback memory (useful in tests)
   */
  clearMemoryFallback() {
    this.memoryCache.clear();
  }
}

module.exports = new CacheService();
