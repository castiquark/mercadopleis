-- Order ids restart at 1 on every escrow deployment, so an order is identified by
-- (chain, escrow contract address, contract order id). Replaces the old global UNIQUE(contract_order_id).
-- Idempotent; safe to run before or after deploying the matching code.
BEGIN;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS escrow_address varchar(42);
CREATE UNIQUE INDEX IF NOT EXISTS orders_chain_escrow_order_unique
  ON orders (chain_id, escrow_address, contract_order_id);
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_contract_order_id_unique;
DROP INDEX IF EXISTS orders_chain_contract_order_unique; -- interim index from an earlier draft of this migration
COMMIT;
