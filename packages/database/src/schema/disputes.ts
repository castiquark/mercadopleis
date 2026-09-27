import { pgTable, uuid, varchar, text, numeric, timestamp } from 'drizzle-orm/pg-core';
import { orders } from './orders';
import { users } from './users';

export const disputes = pgTable('disputes', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').references(() => orders.id).unique().notNull(),
  openedById: uuid('opened_by_id').references(() => users.id).notNull(),
  arbitratorId: uuid('arbitrator_id').references(() => users.id),
  reason: text('reason').notNull(),
  evidenceUrl: text('evidence_url'),
  status: varchar('status', { length: 30 }).notNull().default('OPEN'),
  sellerAwardUsdc: numeric('seller_award_usdc', { precision: 12, scale: 2 }),
  buyerRefundUsdc: numeric('buyer_refund_usdc', { precision: 12, scale: 2 }),
  resolutionNotes: text('resolution_notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
});
