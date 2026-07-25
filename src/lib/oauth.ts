/**
 * src/lib/oauth.ts — Google OAuth 2.0 using Arctic
 * Docs: https://arcticjs.dev/providers/google
 */

import { Google } from 'arctic';
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } from 'astro:env/server';

let _google: InstanceType<typeof Google> | null = null;

export function getGoogleOAuth(): InstanceType<typeof Google> {
  if (_google) return _google;

  const clientId = GOOGLE_CLIENT_ID;
  const clientSecret = GOOGLE_CLIENT_SECRET;
  const redirectUri = GOOGLE_REDIRECT_URI || 'http://localhost:4321/api/auth/google/callback';

  if (!clientId || !clientSecret) {
    throw new Error(
      'Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET environment variables. ' +
      'See .env.example for setup instructions.'
    );
  }

  _google = new Google(clientId, clientSecret, redirectUri);
  return _google;
}
