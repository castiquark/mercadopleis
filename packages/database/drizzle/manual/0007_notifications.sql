-- Browser push and Telegram notifications.
-- Idempotent. Apply BEFORE deploying the code that uses it (order, message, dispute and proposal routes notify).
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint   text        NOT NULL UNIQUE,
  p256dh     text        NOT NULL,
  auth       text        NOT NULL,
  lang       varchar(2)  NOT NULL DEFAULT 'es',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON push_subscriptions (user_id);

CREATE TABLE IF NOT EXISTS telegram_links (
  user_id   uuid        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  chat_id   bigint      NOT NULL,
  lang      varchar(2)  NOT NULL DEFAULT 'es',
  linked_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS telegram_link_codes (
  code       varchar(64) PRIMARY KEY,
  user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lang       varchar(2)  NOT NULL DEFAULT 'es',
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS notification_log (
  key        varchar(200) PRIMARY KEY,
  created_at timestamptz  NOT NULL DEFAULT now()
);
