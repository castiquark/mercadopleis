import { pgTable, uuid, text, varchar, timestamp, bigint } from 'drizzle-orm/pg-core';
import { users } from './users';

// Browser push subscriptions (Web Push). One row per browser; a user can have several.
export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  endpoint: text('endpoint').unique().notNull(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  lang: varchar('lang', { length: 2 }).default('es').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Telegram chat linked to a user (one per user).
export const telegramLinks = pgTable('telegram_links', {
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).primaryKey(),
  chatId: bigint('chat_id', { mode: 'number' }).notNull(),
  lang: varchar('lang', { length: 2 }).default('es').notNull(),
  linkedAt: timestamp('linked_at', { withTimezone: true }).defaultNow().notNull(),
});

// Short-lived codes for the t.me/<bot>?start=<code> link that connects a chat to a user.
export const telegramLinkCodes = pgTable('telegram_link_codes', {
  code: varchar('code', { length: 64 }).primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  lang: varchar('lang', { length: 2 }).default('es').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

// One row per notification already sent, so the same event (e.g. an order delivered, seen by both the API and the
// on-chain indexer) is announced once.
export const notificationLog = pgTable('notification_log', {
  key: varchar('key', { length: 200 }).primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
