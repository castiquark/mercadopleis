import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../apps/web/.env.local') });

const url = process.env.DATABASE_URL;
if (!url) {
  console.log('No DATABASE_URL found');
  process.exit(1);
}

const sql = postgres(url, { ssl: 'require' });

async function run() {
  console.log('Connecting to Postgres at Neon...');
  await sql`ALTER TABLE services ADD COLUMN IF NOT EXISTS delivery_type varchar(20) DEFAULT 'digital' NOT NULL;`;
  await sql`ALTER TABLE services ADD COLUMN IF NOT EXISTS country varchar(100);`;
  await sql`ALTER TABLE services ADD COLUMN IF NOT EXISTS city varchar(100);`;
  await sql`ALTER TABLE services ADD COLUMN IF NOT EXISTS locality varchar(150);`;
  await sql`ALTER TABLE services ADD COLUMN IF NOT EXISTS address_or_reference text;`;
  console.log('Successfully updated services table columns!');
  await sql.end();
}

run().catch((e) => {
  console.error('Error running migration:', e);
  process.exit(1);
});
