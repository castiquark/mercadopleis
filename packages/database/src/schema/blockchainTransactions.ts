import { pgTable, uuid, varchar, integer, bigint, timestamp } from 'drizzle-orm/pg-core';
import { orders } from './orders';

export const blockchainTransactions = pgTable('blockchain_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').references(() => orders.id),
  txHash: varchar('tx_hash', { length: 66 }).unique().notNull(),
  chainId: integer('chain_id').notNull(),
  eventType: varchar('event_type', { length: 50 }).notNull(),
  blockNumber: bigint('block_number', { mode: 'number' }).notNull(),
  status: varchar('status', { length: 30 }).notNull().default('CONFIRMED'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
