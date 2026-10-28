const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const config = require('./config');
const { getPool, closePostgres, checkPostgresHealth } = require('./db/postgres');
const { connectMongo, closeMongo } = require('./db/mongo');
const { getRedisClient, closeRedis } = require('./db/redis');
const { initializeSocketHandlers } = require('./sockets/socketHandler');

async function startServer() {
  const server = http.createServer(app);

  // Initialize Socket.io
  const io = new Server(server, {
    cors: {
      origin: config.clientUrl,
      credentials: true,
    },
  });

  // Attach WebSocket handlers
  initializeSocketHandlers(io);

  // Initialize Database Connections
  console.log('----------------------------------------------------');
  console.log('Starting Capstone Social Media Backend...');
  console.log(`Environment: ${config.env}`);

  // 1. PostgreSQL
  try {
    getPool();
    const isPgHealthy = await checkPostgresHealth();
    if (isPgHealthy) {
      console.log('[PostgreSQL] Connected and healthy');
    } else {
      console.warn('[PostgreSQL] Connection check returned false. Ensure PostgreSQL service is running.');
    }
  } catch (err) {
    console.error('[PostgreSQL] Connection warning:', err.message);
  }

  // 2. MongoDB
  try {
    await connectMongo();
  } catch (err) {
    console.warn('[MongoDB] Connection warning (chat persistence may be unavailable until started):', err.message);
  }

  // 3. Redis
  try {
    getRedisClient();
  } catch (err) {
    console.warn('[Redis] Connection warning:', err.message);
  }

  // Start HTTP Server
  server.listen(config.port, () => {
    console.log(`[HTTP Server] Listening on port ${config.port}`);
    console.log(`[Health] Status endpoint available at http://localhost:${config.port}/health`);
    console.log('----------------------------------------------------');
  });

  // Graceful shutdown handling
  const gracefulShutdown = async (signal) => {
    console.log(`\nReceived ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      console.log('[HTTP Server] Closed.');
      try {
        await Promise.all([closePostgres(), closeMongo(), closeRedis()]);
        console.log('[Databases] All connections closed cleanly.');
        process.exit(0);
      } catch (err) {
        console.error('[Shutdown Error]:', err);
        process.exit(1);
      }
    });

    // Force shutdown if taking longer than 10s
    setTimeout(() => {
      console.error('Forced shutdown due to timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  return { server, io };
}

if (require.main === module) {
  startServer().catch((err) => {
    console.error('Fatal server startup failure:', err);
    process.exit(1);
  });
}

module.exports = { startServer };
