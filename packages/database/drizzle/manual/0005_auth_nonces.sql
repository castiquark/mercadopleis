-- Sign-in nonces in their own table: requesting a nonce no longer inserts a users row for any address queried.
-- Idempotent. Apply BEFORE deploying the code that uses it (sign-in fails until the table exists).
-- users.nonce stays for now (unused) and can be dropped later.
CREATE TABLE IF NOT EXISTS auth_nonces (
  wallet_address varchar(42)  PRIMARY KEY,
  nonce          varchar(100) NOT NULL,
  expires_at     timestamptz  NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_nonces_expires_at_idx ON auth_nonces (expires_at);
