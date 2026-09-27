import fs from 'fs';
import path from 'path';
import { PGlite } from '@electric-sql/pglite';
import postgres from 'postgres';

export async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL;
  const migrationSqlPath = path.resolve(__dirname, '../drizzle/0000_dizzy_green_goblin.sql');
  const migrationSql = fs.readFileSync(migrationSqlPath, 'utf8');

  // Split migration statements by breakpoint
  const statements = migrationSql
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (databaseUrl && databaseUrl.startsWith('postgres')) {
    console.log('[Database] Running migrations on PostgreSQL URL...');
    const sql = postgres(databaseUrl, { max: 1 });
    try {
      for (const statement of statements) {
        await sql.unsafe(statement);
      }
      console.log('[Database] PostgreSQL migrations applied successfully!');
    } finally {
      await sql.end();
    }
  } else {
    console.log('[Database] Running embedded PGlite migrations...');
    const rootDir = path.resolve(__dirname, '../../../');
    const dataDir = path.resolve(rootDir, '.data/postgres');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const pglite = new PGlite(dataDir);
    try {
      for (const statement of statements) {
        await pglite.query(statement);
      }
      console.log('[Database] PGlite migrations applied successfully in:', dataDir);
    } catch (err: any) {
      if (err?.message?.includes('already exists')) {
        console.log('[Database] Tables already exist in PGlite storage.');
      } else {
        throw err;
      }
    } finally {
      await pglite.close();
    }
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Database] Migration failed:', err);
      process.exit(1);
    });
}
