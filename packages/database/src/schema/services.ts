import { pgTable, uuid, varchar, text, numeric, integer, boolean, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const services = pgTable('services', {
  id: uuid('id').primaryKey().defaultRandom(),
  sellerId: uuid('seller_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  description: text('description').notNull(),
  category: varchar('category', { length: 50 }).notNull(),
  priceUsdc: numeric('price_usdc', { precision: 12, scale: 2 }).notNull(),
  deliveryDays: integer('delivery_days').notNull(),
  coverImageUrl: text('cover_image_url'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
