-- Fixed-window counters for API rate limiting (shared across serverless instances).
-- Idempotent. Apply before or after deploying the code that uses it; until the table exists the
-- limiter fails open (requests are allowed and the error is logged).
CREATE TABLE IF NOT EXISTS rate_limits (
  key          varchar(200) NOT NULL,
  window_start timestamptz  NOT NULL,
  count        integer      NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);
CREATE INDEX IF NOT EXISTS rate_limits_window_start_idx ON rate_limits (window_start);
