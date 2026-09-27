import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { orders } from './orders';
import { users } from './users';

export const reviews = pgTable('reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').references(() => orders.id).unique().notNull(),
  reviewerId: uuid('reviewer_id').references(() => users.id).notNull(),
  reviewedUserId: uuid('reviewed_user_id').references(() => users.id).notNull(),
  rating: integer('rating').notNull(), // 1 to 5
  comment: text('comment').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
