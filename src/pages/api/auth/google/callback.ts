// src/pages/api/auth/google/callback.ts — Google OAuth callback
import type { APIRoute } from 'astro';
import { getGoogleOAuth } from '../../../../lib/oauth';
import { upsertUser, createSession, getProfilesByUserId, createProfile, SESSION_COOKIE } from '../../../../lib/db';

export const GET: APIRoute = async ({ url, request, locals }) => {
  const db = locals.runtime.env.DB;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code || !state) {
    return Response.redirect(new URL('/login?error=missing_params', url).toString(), 302);
  }

  // Read state + verifier from cookies
  const cookieHeader = request.headers.get('cookie') ?? '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map((c) => {
      const [k, ...v] = c.trim().split('=');
      return [k.trim(), decodeURIComponent(v.join('='))];
    })
  );

  const storedState = cookies['google_oauth_state'];
  const codeVerifier = cookies['google_oauth_verifier'];

  if (!storedState || storedState !== state || !codeVerifier) {
    return Response.redirect(new URL('/login?error=invalid_state', url).toString(), 302);
  }

  try {
    const google = getGoogleOAuth(url.origin);

    // Exchange code for tokens
    const tokens = await google.validateAuthorizationCode(code, codeVerifier);
    const accessToken = tokens.accessToken();

    // Fetch Google user info
    const googleUserRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!googleUserRes.ok) {
      throw new Error('Failed to fetch Google user info');
    }

    const googleUser = await googleUserRes.json() as {
      sub: string;
      email: string;
      name: string;
      picture?: string;
    };

    // Upsert user in DB
    const user = await upsertUser(db, {
      google_id: googleUser.sub,
      email: googleUser.email,
      name: googleUser.name,
      avatar_url: googleUser.picture ?? null,
    });

    // Create a default profile if this is the user's first sign-in
    const profiles = await getProfilesByUserId(db, user.id);
    if (profiles.length === 0) {
      await createProfile(db, {
        user_id: user.id,
        name: user.name.split(' ')[0] ?? user.name,
        avatar_color: '#4285F4',
        is_kids: 0,
        is_default: 1,
      });
    }

    // Create session
    const session = await createSession(db, user.id);

    // Build redirect — send user to /profile on first login, else /
    const redirectTo = profiles.length === 0 ? '/profile' : '/';

    // Host-only cookie: no explicit Domain, so it is scoped to whatever host
    // served the request. A hardcoded Domain silently broke sign-in every time
    // the site moved to a new domain. `Secure` follows the actual scheme rather
    // than the build mode, so a production build served over http still works.
    const sessionCookie = [
      `${SESSION_COOKIE}=${session.id}`,
      'HttpOnly',
      url.protocol === 'https:' ? 'Secure' : '',
      'SameSite=Lax',
      'Max-Age=2592000', // 30 days
      'Path=/',
    ].filter(Boolean).join('; ');

    // Clear oauth state cookies
    const clearState = 'google_oauth_state=; Max-Age=0; Path=/; HttpOnly';
    const clearVerifier = 'google_oauth_verifier=; Max-Age=0; Path=/; HttpOnly';

    return new Response(null, {
      status: 302,
      headers: {
        Location: redirectTo,
        'Set-Cookie': [sessionCookie, clearState, clearVerifier].join(', '),
      },
    });
  } catch (e) {
    console.error('OAuth callback error:', e);
    const msg = encodeURIComponent(e instanceof Error ? e.message : 'auth_error');
    return Response.redirect(new URL(`/login?error=${msg}`, url).toString(), 302);
  }
};
