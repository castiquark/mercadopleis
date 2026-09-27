import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export * from './schema';

let client: postgres.Sql;

export function getDatabaseClient(connectionString?: string) {
  const url = connectionString || process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/mercadopleis';
  if (!client) {
    client = postgres(url, { max: 10 });
  }
  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof getDatabaseClient>;
export const db = getDatabaseClient();
