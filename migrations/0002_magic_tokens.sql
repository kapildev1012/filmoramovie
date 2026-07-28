-- ============================================================
-- Filmora Movie — Magic Link tokens (0002)
-- Adds passwordless email authentication support.
-- ============================================================

-- Magic tokens: one-time-use, time-limited tokens sent via email.
CREATE TABLE IF NOT EXISTS magic_tokens (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  token_hash  TEXT NOT NULL UNIQUE,       -- SHA-256 hash of the raw token
  expires_at  INTEGER NOT NULL,           -- unix timestamp (seconds)
  used_at     TEXT,                       -- datetime when consumed (NULL = unused)
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Fast lookup by token hash during verification
CREATE INDEX IF NOT EXISTS magic_tokens_hash ON magic_tokens(token_hash);

-- Rate-limit query: count recent tokens per email
CREATE INDEX IF NOT EXISTS magic_tokens_email_created ON magic_tokens(email, created_at);

-- Cleanup: find expired/used tokens for periodic purge
CREATE INDEX IF NOT EXISTS magic_tokens_expires ON magic_tokens(expires_at);
