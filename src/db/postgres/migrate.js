const fs = require('fs');
const path = require('path');
const { query, closePostgres } = require('./index');

async function runMigrations() {
  console.log('[Migration] Starting PostgreSQL database migration...');
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  try {
    await query(sql);
    console.log('[Migration] Schema migration executed successfully.');
  } catch (error) {
    console.error('[Migration] Migration failed:', error.message);
    process.exit(1);
  } finally {
    await closePostgres();
  }
}

if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };
