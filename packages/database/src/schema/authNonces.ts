import { pgTable, index, varchar, timestamp } from 'drizzle-orm/pg-core';

// Pending sign-in challenges, one per wallet. Kept apart from users so that asking for a nonce never creates
// an account: the users row is only written after a valid signature.
export const authNonces = pgTable(
  'auth_nonces',
  {
    walletAddress: varchar('wallet_address', { length: 42 }).primaryKey(),
    nonce: varchar('nonce', { length: 100 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [index('auth_nonces_expires_at_idx').on(table.expiresAt)]
);
