-- Request marketplace (bounties): buyers post tasks, sellers send proposals, the accepted proposal becomes an
-- unlisted service that is funded through the regular escrow order flow.
-- Idempotent. Apply BEFORE deploying the code that uses it (the catalog filters on services.is_listed).
ALTER TABLE services ADD COLUMN IF NOT EXISTS is_listed boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS requests (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title               varchar(255) NOT NULL,
  slug                varchar(255) NOT NULL UNIQUE,
  description         text NOT NULL,
  category            varchar(50) NOT NULL,
  budget_usdc         numeric(12, 2) NOT NULL,
  delivery_days       integer NOT NULL,
  status              varchar(20) NOT NULL DEFAULT 'OPEN',
  awarded_proposal_id uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS requests_status_created_idx ON requests (status, created_at);

CREATE TABLE IF NOT EXISTS request_proposals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id    uuid NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  seller_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  price_usdc    numeric(12, 2) NOT NULL,
  delivery_days integer NOT NULL,
  message       text NOT NULL,
  status        varchar(20) NOT NULL DEFAULT 'PENDING',
  service_id    uuid REFERENCES services(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS request_proposals_request_seller_unique ON request_proposals (request_id, seller_id);
