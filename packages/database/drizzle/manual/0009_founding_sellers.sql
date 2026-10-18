-- Founding Seller badge: number 1–25 for the first sellers, assigned by an admin.
-- Idempotent. Apply BEFORE deploying the code that uses it (the catalog query orders by this column).
ALTER TABLE users ADD COLUMN IF NOT EXISTS founding_seller_number smallint;
DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_founding_seller_number_key UNIQUE (founding_seller_number);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_founding_seller_number_range CHECK (founding_seller_number BETWEEN 1 AND 25);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
