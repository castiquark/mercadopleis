-- When each party last read an order's message thread (unread counts in the activity menu).
-- Idempotent. Apply BEFORE deploying the code that uses it (the activity endpoint and message reads use it).
CREATE TABLE IF NOT EXISTS order_reads (
  user_id      uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id     uuid        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, order_id)
);
