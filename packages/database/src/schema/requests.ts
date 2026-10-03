import { pgTable, uniqueIndex, index, uuid, varchar, text, numeric, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { users } from './users';
import { services } from './services';

// A buyer (person or agent) describes a task; sellers answer with proposals. Accepting a proposal creates an
// unlisted service with the agreed terms, so funding, delivery, disputes and payout reuse the regular order flow.
export const requests = pgTable(
  'requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    buyerId: uuid('buyer_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    description: text('description').notNull(),
    category: varchar('category', { length: 50 }).notNull(),
    budgetUsdc: numeric('budget_usdc', { precision: 12, scale: 2 }).notNull(),
    deliveryDays: integer('delivery_days').notNull(),
    // OPEN (taking proposals) | AWARDED (a proposal was accepted) | CANCELLED
    status: varchar('status', { length: 20 }).notNull().default('OPEN'),
    awardedProposalId: uuid('awarded_proposal_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('requests_status_created_idx').on(table.status, table.createdAt)]
);

export const requestProposals = pgTable(
  'request_proposals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestId: uuid('request_id').references(() => requests.id, { onDelete: 'cascade' }).notNull(),
    sellerId: uuid('seller_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    priceUsdc: numeric('price_usdc', { precision: 12, scale: 2 }).notNull(),
    deliveryDays: integer('delivery_days').notNull(),
    message: text('message').notNull(),
    // Optional phases [{ title, amountUsdc, deliveryDays }]; each becomes its own unlisted service and escrow order.
    milestones: jsonb('milestones').$type<{ title: string; amountUsdc: string; deliveryDays: number }[]>(),
    // PENDING | ACCEPTED | REJECTED | WITHDRAWN
    status: varchar('status', { length: 20 }).notNull().default('PENDING'),
    // Unlisted service created when the proposal is accepted (the first phase when it has milestones).
    serviceId: uuid('service_id').references(() => services.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  // One proposal per seller and request (it can be edited while pending).
  (table) => [uniqueIndex('request_proposals_request_seller_unique').on(table.requestId, table.sellerId)]
);
