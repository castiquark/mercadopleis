import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import postgres from 'postgres';
import path from 'path';
import fs from 'fs';
import * as schema from './schema/index';

export * from './schema/index';

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

  // Fallback: check environment
  try {
    if (!pgliteClient) {
      const isServerless = !!(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.VERCEL);
      if (isServerless) {
        // In serverless without DATABASE_URL, instantiate ephemeral in-memory PGlite
        pgliteClient = new PGlite();
      } else {
        const rootDir = path.resolve(__dirname, '../../../');
        const dataDir = path.resolve(rootDir, '.data/postgres');
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }
        pgliteClient = new PGlite(dataDir);
      }
    }
    cachedDb = drizzlePglite(pgliteClient, { schema });
    return cachedDb;
  } catch (err) {
    console.warn('Database initialization warning:', err);
    try {
      pgliteClient = new PGlite();
      cachedDb = drizzlePglite(pgliteClient, { schema });
      return cachedDb;
    } catch (e) {
      console.warn('Ephemeral PGlite fallback failed:', e);
      return null;
    }
  }
}

export type Database = ReturnType<typeof getDatabaseClient>;

// Lazy proxy so that importing `@mercadopleis/database` does not crash module evaluation in serverless
export const db = new Proxy({} as any, {
  get(target, prop) {
    const instance = getDatabaseClient();
    if (!instance) {
      throw new Error('Database client is not available in current environment');
    }
    const val = instance[prop];
    if (typeof val === 'function') {
      return val.bind(instance);
    }
    return val;
  },
});
