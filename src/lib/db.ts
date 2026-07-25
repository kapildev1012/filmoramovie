/**
 * src/lib/db.ts — SQLite database connection via better-sqlite3
 *
 * Database file location is set by DB_PATH env var (defaults to filmora.db in project root).
 * On first run, the schema is automatically applied.
 */

import Database from 'better-sqlite3';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const DB_PATH = import.meta.env.DB_PATH || join(process.cwd(), 'filmora.db');
const SCHEMA_PATH = join(process.cwd(), 'schema.sql');

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;

  _db = new Database(DB_PATH, {
    // Verbose logging only in dev mode
    verbose: import.meta.env.DEV ? (msg) => console.debug('[db]', msg) : undefined,
  });

  // Apply schema on first connect (idempotent — uses IF NOT EXISTS)
  if (existsSync(SCHEMA_PATH)) {
    const schema = readFileSync(SCHEMA_PATH, 'utf-8');
    _db.exec(schema);
  }

  return _db;
}

export default getDb;

// ─── Helpers ─────────────────────────────────────────────────────────────────

import { randomBytes } from 'crypto';

/** Generate a URL-safe random ID (24 chars) */
export function generateId(): string {
  return randomBytes(18).toString('base64url');
}

// ─── User operations ─────────────────────────────────────────────────────────

export interface DBUser {
  id: string;
  google_id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  created_at: string;
}

export function getUserByGoogleId(googleId: string): DBUser | null {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE google_id = ?').get(googleId) as DBUser | null;
}

export function getUserById(id: string): DBUser | null {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as DBUser | null;
}

export function createUser(data: Omit<DBUser, 'id' | 'created_at'>): DBUser {
  const db = getDb();
  const id = generateId();
  db.prepare(
    'INSERT INTO users (id, google_id, email, name, avatar_url) VALUES (?, ?, ?, ?, ?)'
  ).run(id, data.google_id, data.email, data.name, data.avatar_url);
  return getUserById(id)!;
}

export function upsertUser(data: Omit<DBUser, 'id' | 'created_at'>): DBUser {
  const existing = getUserByGoogleId(data.google_id);
  if (existing) {
    const db = getDb();
    db.prepare('UPDATE users SET email = ?, name = ?, avatar_url = ? WHERE id = ?')
      .run(data.email, data.name, data.avatar_url, existing.id);
    return getUserById(existing.id)!;
  }
  return createUser(data);
}

// ─── Session operations ───────────────────────────────────────────────────────

export interface DBSession {
  id: string;
  user_id: string;
  expires_at: number; // unix seconds
}

export function createSession(userId: string): DBSession {
  const db = getDb();
  const id = generateId();
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30; // 30 days
  db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
    .run(id, userId, expiresAt);
  return { id, user_id: userId, expires_at: expiresAt };
}

export function getSession(sessionId: string): (DBSession & { user: DBUser }) | null {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  const row = db.prepare(`
    SELECT s.*, u.google_id, u.email, u.name, u.avatar_url, u.created_at as user_created_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = ? AND s.expires_at > ?
  `).get(sessionId, now) as (DBSession & {
    google_id: string; email: string; name: string; avatar_url: string | null; user_created_at: string;
  }) | null;

  if (!row) return null;
  return {
    id: row.id,
    user_id: row.user_id,
    expires_at: row.expires_at,
    user: {
      id: row.user_id,
      google_id: row.google_id,
      email: row.email,
      name: row.name,
      avatar_url: row.avatar_url,
      created_at: row.user_created_at,
    },
  };
}

export function deleteSession(sessionId: string): void {
  getDb().prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}

export function deleteAllUserSessions(userId: string): void {
  getDb().prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

/** Refresh session expiry (rolling session) */
export function refreshSession(sessionId: string): void {
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;
  getDb().prepare('UPDATE sessions SET expires_at = ? WHERE id = ?').run(expiresAt, sessionId);
}

// ─── Profile operations ───────────────────────────────────────────────────────

export interface DBProfile {
  id: string;
  user_id: string;
  name: string;
  avatar_color: string;
  is_kids: number;
  is_default: number;
  created_at: string;
}

export function getProfilesByUserId(userId: string): DBProfile[] {
  return getDb().prepare('SELECT * FROM profiles WHERE user_id = ? ORDER BY is_default DESC, created_at ASC').all(userId) as DBProfile[];
}

export function getProfileById(id: string): DBProfile | null {
  return getDb().prepare('SELECT * FROM profiles WHERE id = ?').get(id) as DBProfile | null;
}

export function createProfile(data: Omit<DBProfile, 'id' | 'created_at'>): DBProfile {
  const db = getDb();
  const existing = getProfilesByUserId(data.user_id);
  if (existing.length >= 5) {
    throw new Error('Maximum 5 profiles per account');
  }
  const id = generateId();
  db.prepare(
    'INSERT INTO profiles (id, user_id, name, avatar_color, is_kids, is_default) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, data.user_id, data.name, data.avatar_color, data.is_kids ? 1 : 0, data.is_default ? 1 : 0);
  return getProfileById(id)!;
}

export function updateProfile(id: string, data: Partial<Pick<DBProfile, 'name' | 'avatar_color' | 'is_kids'>>): void {
  const db = getDb();
  const fields: string[] = [];
  const vals: (string | number)[] = [];
  if (data.name !== undefined) { fields.push('name = ?'); vals.push(data.name); }
  if (data.avatar_color !== undefined) { fields.push('avatar_color = ?'); vals.push(data.avatar_color); }
  if (data.is_kids !== undefined) { fields.push('is_kids = ?'); vals.push(data.is_kids); }
  if (fields.length === 0) return;
  vals.push(id);
  db.prepare(`UPDATE profiles SET ${fields.join(', ')} WHERE id = ?`).run(...vals);
}

export function deleteProfile(id: string): void {
  getDb().prepare('DELETE FROM profiles WHERE id = ?').run(id);
}

export function setDefaultProfile(userId: string, profileId: string): void {
  const db = getDb();
  const txn = db.transaction(() => {
    db.prepare('UPDATE profiles SET is_default = 0 WHERE user_id = ?').run(userId);
    db.prepare('UPDATE profiles SET is_default = 1 WHERE id = ?').run(profileId);
  });
  txn();
}

// ─── Watchlist operations ────────────────────────────────────────────────────

export interface DBWatchlistEntry {
  id: string;
  profile_id: string;
  tmdb_id: number;
  media_type: 'movie' | 'tv';
  title: string;
  poster_path: string | null;
  added_at: string;
}

export function getWatchlist(profileId: string): DBWatchlistEntry[] {
  return getDb().prepare(
    'SELECT * FROM watchlist WHERE profile_id = ? ORDER BY added_at DESC'
  ).all(profileId) as DBWatchlistEntry[];
}

export function isInWatchlist(profileId: string, tmdbId: number, mediaType: 'movie' | 'tv'): boolean {
  const row = getDb().prepare(
    'SELECT 1 FROM watchlist WHERE profile_id = ? AND tmdb_id = ? AND media_type = ?'
  ).get(profileId, tmdbId, mediaType);
  return !!row;
}

export function addToWatchlist(
  profileId: string,
  tmdbId: number,
  mediaType: 'movie' | 'tv',
  title: string,
  posterPath: string | null
): void {
  const db = getDb();
  const id = generateId();
  db.prepare(
    'INSERT OR IGNORE INTO watchlist (id, profile_id, tmdb_id, media_type, title, poster_path) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, profileId, tmdbId, mediaType, title, posterPath);
}

export function removeFromWatchlist(profileId: string, tmdbId: number, mediaType: 'movie' | 'tv'): void {
  getDb().prepare(
    'DELETE FROM watchlist WHERE profile_id = ? AND tmdb_id = ? AND media_type = ?'
  ).run(profileId, tmdbId, mediaType);
}

// ─── Rating operations ───────────────────────────────────────────────────────

export interface DBRating {
  id: string;
  profile_id: string;
  tmdb_id: number;
  media_type: 'movie' | 'tv';
  rating: number;
  created_at: string;
  updated_at: string;
}

export function getRating(profileId: string, tmdbId: number, mediaType: 'movie' | 'tv'): number | null {
  const row = getDb().prepare(
    'SELECT rating FROM ratings WHERE profile_id = ? AND tmdb_id = ? AND media_type = ?'
  ).get(profileId, tmdbId, mediaType) as { rating: number } | null;
  return row?.rating ?? null;
}

export function setRating(
  profileId: string,
  tmdbId: number,
  mediaType: 'movie' | 'tv',
  rating: number
): void {
  const db = getDb();
  const id = generateId();
  db.prepare(`
    INSERT INTO ratings (id, profile_id, tmdb_id, media_type, rating)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (profile_id, tmdb_id, media_type) DO UPDATE SET rating = excluded.rating, updated_at = datetime('now')
  `).run(id, profileId, tmdbId, mediaType, rating);
}

export function deleteRating(profileId: string, tmdbId: number, mediaType: 'movie' | 'tv'): void {
  getDb().prepare(
    'DELETE FROM ratings WHERE profile_id = ? AND tmdb_id = ? AND media_type = ?'
  ).run(profileId, tmdbId, mediaType);
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

const SESSION_COOKIE = 'filmora_session';

/**
 * Extract the current session from a request's cookies.
 * Returns null if no valid session is found.
 */
export function getSessionFromRequest(request: Request): (DBSession & { user: DBUser }) | null {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map((c) => {
      const [k, ...v] = c.trim().split('=');
      return [k, decodeURIComponent(v.join('='))];
    })
  );
  const sessionId = cookies[SESSION_COOKIE];
  if (!sessionId) return null;
  return getSession(sessionId);
}

export { SESSION_COOKIE };
