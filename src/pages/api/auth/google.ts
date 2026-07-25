// src/pages/api/auth/google.ts — Initiates Google OAuth flow
import type { APIRoute } from 'astro';
import { getGoogleOAuth } from '../../../lib/oauth';
import { generateCodeVerifier, generateState } from 'arctic';

export const GET: APIRoute = async () => {
  let authUrl: URL;
  const state = generateState();
  const codeVerifier = generateCodeVerifier();

  try {
    const google = getGoogleOAuth();
    authUrl = google.createAuthorizationURL(state, codeVerifier, ['openid', 'profile', 'email']);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'OAuth configuration error';
    return new Response(
      `<html><body><p style="font-family:sans-serif;color:#888;padding:2rem">${msg}<br/><a href="/login">Back to login</a></p></body></html>`,
      { status: 500, headers: { 'Content-Type': 'text/html' } }
    );
  }

  // Store state + verifier in short-lived cookies for CSRF protection
  const cookieOpts = 'HttpOnly; Secure; SameSite=Lax; Max-Age=600; Path=/';

  return new Response(null, {
    status: 302,
    headers: {
      Location: authUrl.toString(),
      'Set-Cookie': [
        `google_oauth_state=${state}; ${cookieOpts}`,
        `google_oauth_verifier=${codeVerifier}; ${cookieOpts}`,
      ].join(', '),
    },
  });
};
