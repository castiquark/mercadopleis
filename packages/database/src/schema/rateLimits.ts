import { pgTable, varchar, integer, timestamp, primaryKey } from 'drizzle-orm/pg-core';

// Fixed-window counters used for API rate limiting. Shared across serverless instances.
export const rateLimits = pgTable(
  'rate_limits',
  {
    key: varchar('key', { length: 200 }).notNull(),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    count: integer('count').notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.key, table.windowStart] })]
);
