-- ============================================================
-- Filmora Movie — SQLite schema
-- ============================================================
-- Usage: sqlite3 filmora.db < schema.sql
-- ============================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ─── Users ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,              -- nanoid
  google_id   TEXT NOT NULL UNIQUE,
  email       TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  avatar_url  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Sessions (Lucia) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL                   -- unix timestamp seconds
);

CREATE INDEX IF NOT EXISTS sessions_user_id ON sessions(user_id);

-- ─── Profiles (up to 5 per account) ─────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  avatar_color  TEXT NOT NULL DEFAULT '#4285F4',
  is_kids       INTEGER NOT NULL DEFAULT 0,     -- 0 = false, 1 = true
  is_default    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  CONSTRAINT profiles_max_per_user CHECK (
    (SELECT COUNT(*) FROM profiles p2 WHERE p2.user_id = profiles.user_id) <= 5
  )
);

CREATE INDEX IF NOT EXISTS profiles_user_id ON profiles(user_id);

-- ─── Watchlist ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS watchlist (
  id          TEXT PRIMARY KEY,
  profile_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tmdb_id     INTEGER NOT NULL,
  media_type  TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
  title       TEXT NOT NULL,
  poster_path TEXT,
  added_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (profile_id, tmdb_id, media_type)
);

CREATE INDEX IF NOT EXISTS watchlist_profile_id ON watchlist(profile_id);
CREATE INDEX IF NOT EXISTS watchlist_added_at   ON watchlist(added_at DESC);

-- ─── Ratings (1–5 stars) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS ratings (
  id          TEXT PRIMARY KEY,
  profile_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tmdb_id     INTEGER NOT NULL,
  media_type  TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (profile_id, tmdb_id, media_type)
);

CREATE INDEX IF NOT EXISTS ratings_profile_id ON ratings(profile_id);

-- ─── Watch progress (episodes) ───────────────────────────────
CREATE TABLE IF NOT EXISTS watch_progress (
  id              TEXT PRIMARY KEY,
  profile_id      TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tmdb_id         INTEGER NOT NULL,     -- series id
  season_number   INTEGER NOT NULL,
  episode_number  INTEGER NOT NULL,
  watched         INTEGER NOT NULL DEFAULT 1,   -- 0 = unwatched, 1 = watched
  marked_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (profile_id, tmdb_id, season_number, episode_number)
);

CREATE INDEX IF NOT EXISTS watch_progress_profile ON watch_progress(profile_id, tmdb_id);

-- ─── Cookie consent log ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS consent_log (
  id          TEXT PRIMARY KEY,
  user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  level       TEXT NOT NULL CHECK (level IN ('all', 'essential')),
  preferences INTEGER NOT NULL DEFAULT 0,
  analytics   INTEGER NOT NULL DEFAULT 0,
  ip_hash     TEXT,                     -- SHA-256 of IP for GDPR audit trail
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
