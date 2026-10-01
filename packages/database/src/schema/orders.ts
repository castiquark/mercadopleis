import { pgTable, uniqueIndex, uuid, varchar, text, numeric, integer, bigint, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';
import { services } from './services';

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  contractOrderId: bigint('contract_order_id', { mode: 'number' }),
  serviceId: uuid('service_id').references(() => services.id).notNull(),
  buyerId: uuid('buyer_id').references(() => users.id).notNull(),
  sellerId: uuid('seller_id').references(() => users.id).notNull(),
  chainId: integer('chain_id').notNull().default(8453),
  grossAmountUsdc: numeric('gross_amount_usdc', { precision: 12, scale: 2 }).notNull(),
  platformFeeBps: integer('platform_fee_bps').notNull().default(300),
  platformFeeUsdc: numeric('platform_fee_usdc', { precision: 12, scale: 2 }).notNull(),
  sellerAmountUsdc: numeric('seller_amount_usdc', { precision: 12, scale: 2 }).notNull(),
  status: varchar('status', { length: 30 }).notNull().default('CREATED'),
  deadlineTimestamp: bigint('deadline_timestamp', { mode: 'number' }).notNull(),
  deliveryHash: varchar('delivery_hash', { length: 66 }),
  deliveryReferenceUrl: text('delivery_reference_url'),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  releasedAt: timestamp('released_at', { withTimezone: true }),
  autoReleaseDeadline: bigint('auto_release_deadline', { mode: 'number' }),
  txHashFunding: varchar('tx_hash_funding', { length: 66 }),
  txHashRelease: varchar('tx_hash_release', { length: 66 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  // Contract order ids are only unique per chain/escrow deployment.
  uniqueIndex('orders_chain_contract_order_unique').on(table.chainId, table.contractOrderId),
]);
