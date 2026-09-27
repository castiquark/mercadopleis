import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  walletAddress: varchar('wallet_address', { length: 42 }).notNull().unique(),
  smartAccountAddress: varchar('smart_account_address', { length: 42 }),
  username: varchar('username', { length: 50 }).notNull().unique(),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  bio: text('bio'),
  avatarUrl: text('avatar_url'),
  country: varchar('country', { length: 2 }),
  role: varchar('role', { length: 20 }).notNull().default('USER'),
  nonce: varchar('nonce', { length: 64 }), // For SIWE authentication
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
