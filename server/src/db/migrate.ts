/**
 * Database initialization / migration entry point.
 * Called by `npm run db:init` in server/package.json.
 *
 * Reuses the existing initDb() and runMigrations() implementations —
 * no schema logic is duplicated here.
 */
import 'dotenv/config';
import { initDb, closeDb } from '../config/database';
import { runMigrations } from './schema';

async function main() {
  console.log('[db:init] Initializing database...');
  initDb();
  runMigrations();
  closeDb();
  console.log('[db:init] Done.');
}

main().catch((err) => {
  console.error('[db:init] Fatal error:', err);
  process.exit(1);
});
