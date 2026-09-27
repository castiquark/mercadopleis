import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import postgres from 'postgres';
import path from 'path';
import fs from 'fs';
import * as schema from './schema';

export * from './schema';

let pgClient: postgres.Sql | null = null;
let pgliteClient: PGlite | null = null;
let cachedDb: any = null;

export function getDatabaseClient(connectionString?: string) {
  if (cachedDb) return cachedDb;

  const url = connectionString || process.env.DATABASE_URL;

  if (url && (url.startsWith('postgres://') || url.startsWith('postgresql://'))) {
    if (!pgClient) {
      pgClient = postgres(url, { max: 10 });
    }
    cachedDb = drizzlePg(pgClient, { schema });
    return cachedDb;
  }

  // Local embedded PostgreSQL fallback with PGlite
  if (!pgliteClient) {
    const rootDir = path.resolve(__dirname, '../../../');
    const dataDir = path.resolve(rootDir, '.data/postgres');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    pgliteClient = new PGlite(dataDir);
  }
  cachedDb = drizzlePglite(pgliteClient, { schema });
  return cachedDb;
}

export type Database = ReturnType<typeof getDatabaseClient>;
export const db = getDatabaseClient();
