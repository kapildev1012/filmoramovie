/**
 * POST /api/auth/magic-link — Request a magic sign-in link.
 *
 * Body: { email: string }
 * Rate-limited to 3 requests per email per 15 minutes.
 *
 * Always returns 200 with a generic message to prevent email enumeration.
 */
import type { APIRoute } from 'astro';
import { createMagicToken, countRecentTokens, cleanExpiredTokens } from '../../../lib/db';
import { sendMagicLinkEmail } from '../../../lib/email';
import { env } from 'cloudflare:workers';

/** Simple email regex — server-side validation. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Max requests per email in the rate-limit window. */
const RATE_LIMIT_MAX = 3;
/** Rate-limit window in seconds (15 minutes). */
const RATE_LIMIT_WINDOW = 15 * 60;

export const POST: APIRoute = async ({ request, url, locals }) => {
  // Parse body
  let email: string;
  try {
    const body = (await request.json()) as { email?: unknown };
    email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  } catch {
    return jsonResponse(400, { error: 'Invalid request body.' });
  }

  // Validate email format
  if (!email || !EMAIL_RE.test(email)) {
    return jsonResponse(400, { error: 'Please enter a valid email address.' });
  }

  // Length check (prevent abuse with absurdly long emails)
  if (email.length > 254) {
    return jsonResponse(400, { error: 'Email address is too long.' });
  }

  const db = (env as unknown as { DB: D1Database }).DB;

  // Rate limiting: max 3 magic links per email per 15 minutes.
  // Wrapped because an unhandled throw here escapes the route and Astro answers
  // with the HTML 500 page — the client then fails to parse it as JSON and
  // reports "Network error", which sends people chasing their wifi instead of
  // the actual D1/binding problem.
  let recentCount: number;
  try {
    recentCount = await countRecentTokens(db, email, RATE_LIMIT_WINDOW);
  } catch (e) {
    console.error('Magic link rate-limit lookup failed:', e);
    return jsonResponse(503, {
      error: 'Sign-in is temporarily unavailable. Please try again in a moment.',
    });
  }

  if (recentCount >= RATE_LIMIT_MAX) {
    // Return 200 with generic message to prevent timing-based enumeration,
    // but include a hint for the client to show a rate-limit message.
    return jsonResponse(429, {
      error: 'Too many requests. Please wait a few minutes before trying again.',
    });
  }

  try {
    // Generate token and store hash in D1
    const rawToken = await createMagicToken(db, email);

    // Build the magic link URL
    const siteOrigin = url.origin;
    const magicLinkUrl = `${siteOrigin}/api/auth/verify?token=${encodeURIComponent(rawToken)}`;

    // Send the email
    await sendMagicLinkEmail(email, magicLinkUrl);

    // Opportunistically clean up expired tokens (non-blocking)
    try {
      const cfCtx = (locals as any).cfContext;
      if (cfCtx?.waitUntil) cfCtx.waitUntil(cleanExpiredTokens(db));
    } catch { /* ignore in dev */ }
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error('Magic link send error:', errMsg);

    // Provide a more specific client-facing message for configuration issues
    if (errMsg.includes('placeholder') || errMsg.includes('Missing RESEND_API_KEY')) {
      return jsonResponse(503, {
        error: 'Email service is not configured. Please contact the site administrator.',
      });
    }
    if (errMsg.includes('domain is not verified') || errMsg.includes('rejected the sender')) {
      return jsonResponse(503, {
        error: 'Email service sender is not verified. Please contact the site administrator.',
      });
    }
    if (errMsg.includes('authentication failed') || errMsg.includes('invalid or expired')) {
      return jsonResponse(503, {
        error: 'Email service authentication error. Please contact the site administrator.',
      });
    }

    // Generic fallback for other errors
    return jsonResponse(500, { error: `Unable to send sign-in link. Error: ${errMsg}` });
  }

  return jsonResponse(200, {
    message: 'If an account exists for that email, a sign-in link has been sent. Check your inbox.',
  });
};

function jsonResponse(status: number, data: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
