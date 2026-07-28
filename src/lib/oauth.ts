/**
 * src/lib/oauth.ts — Google OAuth 2.0 using Arctic
 * Docs: https://arcticjs.dev/providers/google
 */

import { Google, Apple } from 'arctic';
import { 
  GOOGLE_CLIENT_ID, 
  GOOGLE_CLIENT_SECRET, 
  GOOGLE_REDIRECT_URI,
  APPLE_CLIENT_ID,
  APPLE_TEAM_ID,
  APPLE_KEY_ID,
  APPLE_PRIVATE_KEY,
  APPLE_REDIRECT_URI
} from 'astro:env/server';

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

let _apple: InstanceType<typeof Apple> | null = null;

export function getAppleOAuth(): InstanceType<typeof Apple> {
  if (_apple) return _apple;

  const clientId = APPLE_CLIENT_ID;
  const teamId = APPLE_TEAM_ID;
  const keyId = APPLE_KEY_ID;
  const privateKey = APPLE_PRIVATE_KEY;
  const redirectUri = APPLE_REDIRECT_URI || 'http://localhost:4321/api/auth/apple/callback';

  if (!clientId || !teamId || !keyId || !privateKey) {
    throw new Error(
      'Missing APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, or APPLE_PRIVATE_KEY environment variables.'
    );
  }

  // Format private key (replace literal \n with actual newlines if provided in env)
  const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');

  _apple = new Apple(
    clientId,
    teamId,
    keyId,
    new TextEncoder().encode(formattedPrivateKey),
    redirectUri
  );
  return _apple;
}

