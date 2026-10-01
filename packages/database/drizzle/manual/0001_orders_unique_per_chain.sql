-- Contract order ids are only unique within one chain / escrow deployment.
-- Replace the global UNIQUE constraint with a composite (chain_id, contract_order_id).
-- Idempotent; safe to run before or after deploying the matching code.
BEGIN;
CREATE UNIQUE INDEX IF NOT EXISTS orders_chain_contract_order_unique
  ON orders (chain_id, contract_order_id);
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_contract_order_id_unique;
COMMIT;
