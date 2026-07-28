import type { APIRoute } from 'astro';
import { getAppleOAuth } from '../../../lib/oauth';
import { generateState } from 'arctic';

export const GET: APIRoute = async () => {
  let authUrl: URL;
  const state = generateState();

  try {
    const apple = getAppleOAuth();
    // Request name and email
    authUrl = apple.createAuthorizationURL(state, ['name', 'email']);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'OAuth configuration error';
    return new Response(
      `<html><body><p style="font-family:sans-serif;color:#888;padding:2rem">${msg}<br/><a href="/login">Back to login</a></p></body></html>`,
      { status: 500, headers: { 'Content-Type': 'text/html' } }
    );
  }

  // Store state in a short-lived cookie for CSRF protection
  const cookieOpts = 'HttpOnly; Secure; SameSite=Lax; Max-Age=600; Path=/';

  return new Response(null, {
    status: 302,
    headers: {
      Location: authUrl.toString(),
      'Set-Cookie': `apple_oauth_state=${state}; ${cookieOpts}`,
    },
  });
};
