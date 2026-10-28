const { Pool } = require('pg');
const config = require('../../config');

let pool = null;

function getPool() {
  if (!pool) {
    const poolConfig = config.postgres.url
      ? { connectionString: config.postgres.url }
      : {
          host: config.postgres.host,
          port: config.postgres.port,
          database: config.postgres.database,
          user: config.postgres.user,
          password: config.postgres.password,
          ssl: config.postgres.ssl ? { rejectUnauthorized: false } : false,
        };

    pool = new Pool({
      ...poolConfig,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client:', err);
    });
  }
  return pool;
}

async function query(text, params) {
  const p = getPool();
  const start = Date.now();
  try {
    const res = await p.query(text, params);
    const duration = Date.now() - start;
    if (config.env === 'development' && duration > 200) {
      console.warn(`Slow PostgreSQL query (${duration}ms):`, text);
    }
    return res;
  } catch (error) {
    console.error('PostgreSQL query error:', { text, error: error.message });
    throw error;
  }
}

async function getClient() {
  const p = getPool();
  return await p.connect();
}

async function checkPostgresHealth() {
  try {
    const res = await query('SELECT 1 as healthy;');
    return res.rows[0].healthy === 1;
  } catch (error) {
    return false;
  }
}

async function closePostgres() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  getPool,
  query,
  getClient,
  checkPostgresHealth,
  closePostgres,
};
