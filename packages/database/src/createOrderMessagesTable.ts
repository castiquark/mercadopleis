import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

import postgres from 'postgres';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  console.log('[Neon] Connecting to create order_messages table...');
  const sql = postgres(url, { max: 1 });

  try {
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS order_messages (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content text NOT NULL,
        created_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `);
    console.log('[Neon] Table order_messages is ready!');
  } catch (err) {
    console.error('[Neon] Failed to create order_messages table:', err);
  } finally {
    await sql.end();
  }
}

main();
