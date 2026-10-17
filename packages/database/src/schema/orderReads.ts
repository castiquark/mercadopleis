import { pgTable, uuid, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { orders } from './orders';
import { users } from './users';

// When each party last read an order's message thread; drives the unread count in the activity menu.
export const orderReads = pgTable(
  'order_reads',
  {
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'cascade' }).notNull(),
    lastReadAt: timestamp('last_read_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.orderId] })]
);
