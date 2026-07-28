/**
 * GET /api/auth/verify?token=... — Verify a magic link token and sign the user in.
 *
 * Flow:
 * 1. Validate the token (exists, not expired, not used).
 * 2. Mark the token as consumed (single-use).
 * 3. Upsert the user (link to existing account if email matches a Google user).
 * 4. Create a default profile if this is their first sign-in.
 * 5. Create a session and set the cookie.
 * 6. Redirect to / (or /profile on first sign-in).
 */
import type { APIRoute } from 'astro';
import {
  validateMagicToken,
  upsertMagicLinkUser,
  createSession,
  getProfilesByUserId,
  createProfile,
  SESSION_COOKIE,
} from '../../../lib/db';
import { env } from 'cloudflare:workers';

export const GET: APIRoute = async ({ url }) => {
  const token = url.searchParams.get('token');

  if (!token) {
    return redirectWithError(url, 'missing_token');
  }

  const db = (env as unknown as { DB: D1Database }).DB;

  // Validate and consume the token
  const email = await validateMagicToken(db, token);

  if (!email) {
    return redirectWithError(url, 'invalid_or_expired');
  }

  // Upsert user — links to existing Google account if same email exists
  const user = await upsertMagicLinkUser(db, email);

  // Create a default profile if first sign-in
  const profiles = await getProfilesByUserId(db, user.id);
  if (profiles.length === 0) {
    await createProfile(db, {
      user_id: user.id,
      name: user.name.split(' ')[0] ?? user.name,
      avatar_color: '#6366f1',
      is_kids: 0,
      is_default: 1,
    });
  }

  // Create session
  const session = await createSession(db, user.id);

  // Build redirect
  const redirectTo = profiles.length === 0 ? '/profile' : '/';

  const cookieDomain = import.meta.env.PROD ? '; Domain=filmoramovie.com' : '';
  const sessionCookie = [
    `${SESSION_COOKIE}=${session.id}`,
    'HttpOnly',
    import.meta.env.PROD ? 'Secure' : '',
    'SameSite=Lax',
    'Max-Age=2592000', // 30 days
    'Path=/',
    cookieDomain,
  ]
    .filter(Boolean)
    .join('; ');

  return new Response(null, {
    status: 302,
    headers: {
      Location: redirectTo,
      'Set-Cookie': sessionCookie,
    },
  });
};

function redirectWithError(url: URL, error: string): Response {
  const errorMessages: Record<string, string> = {
    missing_token: 'Invalid sign-in link.',
    invalid_or_expired: 'This sign-in link has expired or has already been used. Please request a new one.',
  };
  const msg = encodeURIComponent(errorMessages[error] ?? error);
  return new Response(null, {
    status: 302,
    headers: { Location: `/login?error=${msg}` },
  });
}
