/**
 * POST /api/auth/dev-login
 * 
 * Instant login bypass for local development.
 * Creates a session for a test user without needing an email or OAuth.
 * ONLY works in development mode.
 */
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { upsertUser, createSession, getProfilesByUserId, createProfile, SESSION_COOKIE } from '../../../lib/db';

export const POST: APIRoute = async ({ url }) => {
  // Hard security check: never run in production
  if (import.meta.env.PROD) {
    return new Response(JSON.stringify({ error: 'Not available in production' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const db = (env as unknown as { DB: D1Database }).DB;

    // Create or get the dev user
    const devUser = await upsertUser(db, {
      google_id: 'dev-bypass-12345',
      email: 'developer@localhost',
      name: 'Local Developer',
      avatar_url: null,
    });

    // Create default profile if needed
    const profiles = await getProfilesByUserId(db, devUser.id);
    if (profiles.length === 0) {
      await createProfile(db, {
        user_id: devUser.id,
        name: 'Developer',
        avatar_color: '#a855f7',
        is_kids: 0,
        is_default: 1,
      });
    }

    // Create session
    const session = await createSession(db, devUser.id);
    const redirectTo = profiles.length === 0 ? '/profile' : '/';

    const sessionCookie = [
      `${SESSION_COOKIE}=${session.id}`,
      'HttpOnly',
      'SameSite=Lax',
      'Max-Age=2592000', // 30 days
      'Path=/',
    ].join('; ');

    return new Response(JSON.stringify({ success: true, redirectTo }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': sessionCookie,
      },
    });
  } catch (e) {
    console.error('Dev login error:', e);
    return new Response(JSON.stringify({ error: 'Failed to create dev session' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
