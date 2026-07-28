/**
 * src/lib/db.ts — Cloudflare D1 (SQLite) data layer.
 *
 * D1 is async and has no filesystem/native driver, so every function is async
 * and takes the D1 binding as its first argument. Obtain the binding from the
 * Cloudflare Workers env:
 *
 *   import { env } from 'cloudflare:workers';
 *   const db = (env as unknown as { DB: D1Database }).DB;
 *
 * The schema lives in migrations/0001_init.sql and is applied with
 * `wrangler d1 migrations apply filmora` — it is not applied at runtime.
 */

/** Generate a URL-safe random ID (24 chars) using WebCrypto (Workers-safe). */
export function generateId(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
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

export async function getUserByGoogleId(db: D1Database, googleId: string): Promise<DBUser | null> {
  return await db.prepare('SELECT * FROM users WHERE google_id = ?').bind(googleId).first<DBUser>();
}

export async function getUserById(db: D1Database, id: string): Promise<DBUser | null> {
  return await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<DBUser>();
}

export async function createUser(db: D1Database, data: Omit<DBUser, 'id' | 'created_at'>): Promise<DBUser> {
  const id = generateId();
  await db
    .prepare('INSERT INTO users (id, google_id, email, name, avatar_url) VALUES (?, ?, ?, ?, ?)')
    .bind(id, data.google_id, data.email, data.name, data.avatar_url)
    .run();
  return (await getUserById(db, id))!;
}

export async function upsertUser(db: D1Database, data: Omit<DBUser, 'id' | 'created_at'>): Promise<DBUser> {
  const existing = await getUserByGoogleId(db, data.google_id);
  if (existing) {
    await db
      .prepare('UPDATE users SET email = ?, name = ?, avatar_url = ? WHERE id = ?')
      .bind(data.email, data.name, data.avatar_url, existing.id)
      .run();
    return (await getUserById(db, existing.id))!;
  }
  return createUser(db, data);
}

// ─── Session operations ───────────────────────────────────────────────────────

export interface DBSession {
  id: string;
  user_id: string;
  expires_at: number; // unix seconds
}

export async function createSession(db: D1Database, userId: string): Promise<DBSession> {
  const id = generateId();
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30; // 30 days
  await db
    .prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(id, userId, expiresAt)
    .run();
  return { id, user_id: userId, expires_at: expiresAt };
}

export async function getSession(
  db: D1Database,
  sessionId: string
): Promise<(DBSession & { user: DBUser }) | null> {
  const now = Math.floor(Date.now() / 1000);
  const row = await db
    .prepare(`
      SELECT s.*, u.google_id, u.email, u.name, u.avatar_url, u.created_at as user_created_at
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = ? AND s.expires_at > ?
    `)
    .bind(sessionId, now)
    .first<
      DBSession & {
        google_id: string;
        email: string;
        name: string;
        avatar_url: string | null;
        user_created_at: string;
      }
    >();

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

export async function deleteSession(db: D1Database, sessionId: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
}

export async function deleteAllUserSessions(db: D1Database, userId: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run();
}

/** Refresh session expiry (rolling session). */
export async function refreshSession(db: D1Database, sessionId: string): Promise<void> {
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;
  await db.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?').bind(expiresAt, sessionId).run();
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

export async function getProfilesByUserId(db: D1Database, userId: string): Promise<DBProfile[]> {
  const { results } = await db
    .prepare('SELECT * FROM profiles WHERE user_id = ? ORDER BY is_default DESC, created_at ASC')
    .bind(userId)
    .all<DBProfile>();
  return results;
}

export async function getProfileById(db: D1Database, id: string): Promise<DBProfile | null> {
  return await db.prepare('SELECT * FROM profiles WHERE id = ?').bind(id).first<DBProfile>();
}

export async function createProfile(
  db: D1Database,
  data: Omit<DBProfile, 'id' | 'created_at'>
): Promise<DBProfile> {
  const existing = await getProfilesByUserId(db, data.user_id);
  if (existing.length >= 5) {
    throw new Error('Maximum 5 profiles per account');
  }
  const id = generateId();
  await db
    .prepare('INSERT INTO profiles (id, user_id, name, avatar_color, is_kids, is_default) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, data.user_id, data.name, data.avatar_color, data.is_kids ? 1 : 0, data.is_default ? 1 : 0)
    .run();
  return (await getProfileById(db, id))!;
}

export async function updateProfile(
  db: D1Database,
  id: string,
  data: Partial<Pick<DBProfile, 'name' | 'avatar_color' | 'is_kids'>>
): Promise<void> {
  const fields: string[] = [];
  const vals: (string | number)[] = [];
  if (data.name !== undefined) { fields.push('name = ?'); vals.push(data.name); }
  if (data.avatar_color !== undefined) { fields.push('avatar_color = ?'); vals.push(data.avatar_color); }
  if (data.is_kids !== undefined) { fields.push('is_kids = ?'); vals.push(data.is_kids); }
  if (fields.length === 0) return;
  vals.push(id);
  await db.prepare(`UPDATE profiles SET ${fields.join(', ')} WHERE id = ?`).bind(...vals).run();
}

export async function deleteProfile(db: D1Database, id: string): Promise<void> {
  await db.prepare('DELETE FROM profiles WHERE id = ?').bind(id).run();
}

export async function setDefaultProfile(db: D1Database, userId: string, profileId: string): Promise<void> {
  // D1 batch runs statements atomically (single transaction).
  await db.batch([
    db.prepare('UPDATE profiles SET is_default = 0 WHERE user_id = ?').bind(userId),
    db.prepare('UPDATE profiles SET is_default = 1 WHERE id = ?').bind(profileId),
  ]);
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

export async function getWatchlist(db: D1Database, profileId: string): Promise<DBWatchlistEntry[]> {
  const { results } = await db
    .prepare('SELECT * FROM watchlist WHERE profile_id = ? ORDER BY added_at DESC')
    .bind(profileId)
    .all<DBWatchlistEntry>();
  return results;
}

export async function isInWatchlist(
  db: D1Database,
  profileId: string,
  tmdbId: number,
  mediaType: 'movie' | 'tv'
): Promise<boolean> {
  const row = await db
    .prepare('SELECT 1 FROM watchlist WHERE profile_id = ? AND tmdb_id = ? AND media_type = ?')
    .bind(profileId, tmdbId, mediaType)
    .first();
  return !!row;
}

export async function addToWatchlist(
  db: D1Database,
  profileId: string,
  tmdbId: number,
  mediaType: 'movie' | 'tv',
  title: string,
  posterPath: string | null
): Promise<void> {
  const id = generateId();
  await db
    .prepare('INSERT OR IGNORE INTO watchlist (id, profile_id, tmdb_id, media_type, title, poster_path) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, profileId, tmdbId, mediaType, title, posterPath)
    .run();
}

export async function removeFromWatchlist(
  db: D1Database,
  profileId: string,
  tmdbId: number,
  mediaType: 'movie' | 'tv'
): Promise<void> {
  await db
    .prepare('DELETE FROM watchlist WHERE profile_id = ? AND tmdb_id = ? AND media_type = ?')
    .bind(profileId, tmdbId, mediaType)
    .run();
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

export async function getRating(
  db: D1Database,
  profileId: string,
  tmdbId: number,
  mediaType: 'movie' | 'tv'
): Promise<number | null> {
  const row = await db
    .prepare('SELECT rating FROM ratings WHERE profile_id = ? AND tmdb_id = ? AND media_type = ?')
    .bind(profileId, tmdbId, mediaType)
    .first<{ rating: number }>();
  return row?.rating ?? null;
}

export async function setRating(
  db: D1Database,
  profileId: string,
  tmdbId: number,
  mediaType: 'movie' | 'tv',
  rating: number
): Promise<void> {
  const id = generateId();
  await db
    .prepare(`
      INSERT INTO ratings (id, profile_id, tmdb_id, media_type, rating)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (profile_id, tmdb_id, media_type) DO UPDATE SET rating = excluded.rating, updated_at = datetime('now')
    `)
    .bind(id, profileId, tmdbId, mediaType, rating)
    .run();
}

export async function deleteRating(
  db: D1Database,
  profileId: string,
  tmdbId: number,
  mediaType: 'movie' | 'tv'
): Promise<void> {
  await db
    .prepare('DELETE FROM ratings WHERE profile_id = ? AND tmdb_id = ? AND media_type = ?')
    .bind(profileId, tmdbId, mediaType)
    .run();
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

const SESSION_COOKIE = 'filmora_session';

/**
 * Extract the current session from a request's cookies.
 * Returns null if no valid session is found.
 */
export async function getSessionFromRequest(
  db: D1Database,
  request: Request
): Promise<(DBSession & { user: DBUser }) | null> {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map((c) => {
      const [k, ...v] = c.trim().split('=');
      return [k, decodeURIComponent(v.join('='))];
    })
  );
  const sessionId = cookies[SESSION_COOKIE];
  if (!sessionId) return null;
  return getSession(db, sessionId);
}

export { SESSION_COOKIE };

// ─── Magic Token operations ───────────────────────────────────────────────────

export interface DBMagicToken {
  id: string;
  email: string;
  token_hash: string;
  expires_at: number;
  used_at: string | null;
  created_at: string;
}

/**
 * Hash a raw token with SHA-256 (WebCrypto — Workers-safe).
 * Returns a hex string.
 */
export async function hashToken(raw: string): Promise<string> {
  const data = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate a cryptographically random token (48 URL-safe chars).
 */
export function generateMagicToken(): string {
  const bytes = new Uint8Array(36);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Create a magic link token for the given email.
 * Returns the raw token (to be sent in the email link — never stored raw).
 */
export async function createMagicToken(db: D1Database, email: string): Promise<string> {
  const rawToken = generateMagicToken();
  const tokenHash = await hashToken(rawToken);
  const id = generateId();
  const expiresAt = Math.floor(Date.now() / 1000) + 10 * 60; // 10 minutes

  await db
    .prepare('INSERT INTO magic_tokens (id, email, token_hash, expires_at) VALUES (?, ?, ?, ?)')
    .bind(id, email.toLowerCase(), tokenHash, expiresAt)
    .run();

  return rawToken;
}

/**
 * Validate and consume a magic link token.
 * Returns the email if valid, null if expired/used/not-found.
 */
export async function validateMagicToken(db: D1Database, rawToken: string): Promise<string | null> {
  const tokenHash = await hashToken(rawToken);
  const now = Math.floor(Date.now() / 1000);

  const row = await db
    .prepare('SELECT * FROM magic_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?')
    .bind(tokenHash, now)
    .first<DBMagicToken>();

  if (!row) return null;

  // Mark as used (single-use enforcement)
  await db
    .prepare("UPDATE magic_tokens SET used_at = datetime('now') WHERE id = ?")
    .bind(row.id)
    .run();

  return row.email;
}

/**
 * Count how many magic tokens have been created for an email in the last N seconds.
 * Used for rate limiting.
 */
export async function countRecentTokens(
  db: D1Database,
  email: string,
  windowSeconds: number
): Promise<number> {
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();
  const row = await db
    .prepare('SELECT COUNT(*) as cnt FROM magic_tokens WHERE email = ? AND created_at > ?')
    .bind(email.toLowerCase(), since)
    .first<{ cnt: number }>();
  return row?.cnt ?? 0;
}

/**
 * Delete expired and used tokens older than 1 hour.
 * Call periodically to keep the table small.
 */
export async function cleanExpiredTokens(db: D1Database): Promise<void> {
  const cutoff = Math.floor(Date.now() / 1000) - 3600;
  await db
    .prepare('DELETE FROM magic_tokens WHERE expires_at < ? OR used_at IS NOT NULL')
    .bind(cutoff)
    .run();
}

/**
 * Upsert a user from a magic link sign-in.
 * If a user with this email already exists (e.g. from Google OAuth), return them.
 * Otherwise create a new user with a placeholder google_id.
 */
export async function upsertMagicLinkUser(
  db: D1Database,
  email: string,
  name?: string
): Promise<DBUser> {
  // Check if user already exists by email (could be a Google OAuth user)
  const existing = await db
    .prepare('SELECT * FROM users WHERE email = ?')
    .bind(email.toLowerCase())
    .first<DBUser>();

  if (existing) return existing;

  // Create new user with a unique placeholder google_id
  const id = generateId();
  const placeholderGoogleId = `magic_${id}`;
  const displayName = name || email.split('@')[0] || 'User';

  await db
    .prepare('INSERT INTO users (id, google_id, email, name, avatar_url) VALUES (?, ?, ?, ?, ?)')
    .bind(id, placeholderGoogleId, email.toLowerCase(), displayName, null)
    .run();

  return (await getUserById(db, id))!;
}
