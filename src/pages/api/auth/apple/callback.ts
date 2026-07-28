import type { APIRoute } from 'astro';
import { getAppleOAuth } from '../../../../lib/oauth';
import { upsertUser, createSession, getProfilesByUserId, createProfile, SESSION_COOKIE } from '../../../../lib/db';
import { env } from 'cloudflare:workers';
import { decodeIdToken } from 'arctic';

export const GET: APIRoute = async ({ url, request }) => {
  const db = (env as unknown as { DB: D1Database }).DB;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  // Apple sends user info (name, email) only on the FIRST login, in a form-encoded POST body.
  // We handle it gracefully below, but this is a GET handler, so we mostly rely on the id_token.
  if (!code || !state) {
    return Response.redirect(new URL('/login?error=missing_params', url).toString(), 302);
  }

  // Read state from cookies
  const cookieHeader = request.headers.get('cookie') ?? '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map((c) => {
      const [k, ...v] = c.trim().split('=');
      return [k.trim(), decodeURIComponent(v.join('='))];
    })
  );

  const storedState = cookies['apple_oauth_state'];

  if (!storedState || storedState !== state) {
    return Response.redirect(new URL('/login?error=invalid_state', url).toString(), 302);
  }

  try {
    const apple = getAppleOAuth();

    // Exchange code for tokens
    const tokens = await apple.validateAuthorizationCode(code);
    const idToken = tokens.idToken();
    
    // Decode the id_token to get user info
    const claims = decodeIdToken(idToken) as {
      sub: string;
      email: string;
      email_verified?: boolean;
    };

    if (!claims.sub) {
      throw new Error('Missing sub in Apple id_token');
    }

    // so we default to Apple User or email part)
    const fallbackName = claims.email ? claims.email.split('@')[0] : 'Apple User';
    const user = await upsertUser(db, {
      google_id: `apple_${claims.sub}`,
      email: claims.email || '',
      name: fallbackName,
      avatar_url: null,
    });

    // Create a default profile if this is the user's first sign-in
    const profiles = await getProfilesByUserId(db, user.id);
    if (profiles.length === 0) {
      await createProfile(db, {
        user_id: user.id,
        name: user.name.split(' ')[0] ?? user.name,
        avatar_color: '#000000',
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
    ].filter(Boolean).join('; ');

    // Clear oauth state cookie
    const clearState = 'apple_oauth_state=; Max-Age=0; Path=/; HttpOnly';

    return new Response(null, {
      status: 302,
      headers: {
        Location: redirectTo,
        'Set-Cookie': [sessionCookie, clearState].join(', '),
      },
    });
  } catch (e) {
    console.error('Apple OAuth callback error:', e);
    const msg = encodeURIComponent(e instanceof Error ? e.message : 'auth_error');
    return Response.redirect(new URL(`/login?error=${msg}`, url).toString(), 302);
  }
};
