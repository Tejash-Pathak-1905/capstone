const Redis = require('ioredis');
const config = require('../../config');

let redisClient = null;
let isConnected = false;

function getRedisClient() {
  if (!redisClient) {
    const redisOptions = {
      retryStrategy(times) {
        // Linear backoff capped at 2 seconds
        return Math.min(times * 100, 2000);
      },
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false, // Don't hang queries if Redis is offline
      lazyConnect: true,
    };

    if (config.redis.url) {
      redisClient = new Redis(config.redis.url, redisOptions);
    } else {
      redisClient = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        ...redisOptions,
      });
    }

    redisClient.on('connect', () => {
      isConnected = true;
      console.log('[Redis] Connected successfully');
    });

    redisClient.on('error', (err) => {
      isConnected = false;
      // Log as warning rather than uncaught error to prevent crashing if Redis is offline
      if (config.env === 'development') {
        // Limit noisy reconnection logs
      }
    });

    redisClient.on('close', () => {
      isConnected = false;
    });

    // Attempt initial connect asynchronously
    redisClient.connect().catch((err) => {
      console.warn('[Redis] Initial connection failed (caching will degrade gracefully):', err.message);
    });
  }

  return redisClient;
}

async function checkRedisHealth() {
  if (!redisClient || !isConnected) return false;
  try {
    const pong = await redisClient.ping();
    return pong === 'PONG';
  } catch (error) {
    return false;
  }
}

async function closeRedis() {
  if (redisClient) {
    await redisClient.quit().catch(() => {});
    redisClient = null;
    isConnected = false;
  }
}

module.exports = {
  getRedisClient,
  checkRedisHealth,
  closeRedis,
};
