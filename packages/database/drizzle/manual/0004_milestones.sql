-- Milestones for request proposals: each phase becomes an unlisted service funded as its own escrow order.
-- Idempotent. Apply after 0003 and before deploying the code that uses it.
ALTER TABLE request_proposals ADD COLUMN IF NOT EXISTS milestones jsonb;
ALTER TABLE services ADD COLUMN IF NOT EXISTS proposal_id uuid;
ALTER TABLE services ADD COLUMN IF NOT EXISTS milestone_index integer;
ALTER TABLE services ADD COLUMN IF NOT EXISTS milestone_count integer;
CREATE INDEX IF NOT EXISTS services_proposal_id_idx ON services (proposal_id);
