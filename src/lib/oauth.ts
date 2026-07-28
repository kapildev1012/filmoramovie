/**
 * src/lib/oauth.ts — Google OAuth 2.0 using Arctic
 * Docs: https://arcticjs.dev/providers/google
 */

import { Google } from 'arctic';
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } from 'astro:env/server';

export const GOOGLE_CALLBACK_PATH = '/api/auth/google/callback';

/**
 * Resolve the redirect URI Google should send the user back to.
 *
 * `GOOGLE_REDIRECT_URI` wins when set, so a deployment can pin an exact value.
 * Otherwise it is derived from the origin of the incoming request, which keeps
 * sign-in working when the site moves to a different host (localhost, a
 * duckdns subdomain, a custom domain) without another code or secret change.
 * The value MUST still be registered as an authorized redirect URI on the
 * Google OAuth client, or Google rejects the flow with redirect_uri_mismatch.
 */
export function resolveRedirectUri(origin?: string): string {
  if (GOOGLE_REDIRECT_URI) return GOOGLE_REDIRECT_URI;
  if (origin) return new URL(GOOGLE_CALLBACK_PATH, origin).toString();
  return `http://localhost:4321${GOOGLE_CALLBACK_PATH}`;
}

// Cached per redirect URI: the authorization request and the token exchange are
// two separate requests and both must use the identical redirect_uri.
const cache = new Map<string, InstanceType<typeof Google>>();

export function getGoogleOAuth(origin?: string): InstanceType<typeof Google> {
  const clientId = GOOGLE_CLIENT_ID;
  const clientSecret = GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      'Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET environment variables. ' +
      'See .env.example for setup instructions.'
    );
  }

  const redirectUri = resolveRedirectUri(origin);
  const cached = cache.get(redirectUri);
  if (cached) return cached;

  const google = new Google(clientId, clientSecret, redirectUri);
  cache.set(redirectUri, google);
  return google;
}
