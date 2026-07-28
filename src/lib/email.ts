/**
 * src/lib/email.ts — Email delivery via Resend API.
 *
 * Sends transactional emails (magic link sign-in) using the Resend REST API.
 * No SDK dependency — just a fetch call to their endpoint.
 *
 * Required env vars:
 *   RESEND_API_KEY — Your Resend API key (re_...)
 *   FROM_EMAIL     — Verified sender email (e.g. noreply@filmoramovie.com)
 */

import { RESEND_API_KEY, FROM_EMAIL } from 'astro:env/server';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/** Check whether the API key looks like a placeholder (not a real key). */
function isPlaceholderKey(key: string): boolean {
  // Placeholder patterns: all x's, contains "xxxx", or is the exact example value
  return /^re_x+$/.test(key) || key === 're_xxxxxxxxxxxx' || /x{4,}/.test(key);
}

/**
 * Send an email via the Resend API.
 * Throws on failure so the caller can handle it.
 */
export async function sendEmail(options: SendEmailOptions): Promise<{ id: string }> {
  const apiKey = RESEND_API_KEY;
  const from = FROM_EMAIL;

  if (!apiKey || !from) {
    throw new Error(
      'Missing RESEND_API_KEY or FROM_EMAIL environment variables. ' +
        'See .env.example for setup instructions.'
    );
  }

  if (isPlaceholderKey(apiKey)) {
    throw new Error(
      'RESEND_API_KEY is still set to a placeholder value. ' +
        'Get a real API key from https://resend.com/api-keys and update your .env file.'
    );
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [options.to],
      subject: options.subject,
      html: options.html,
      text: options.text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();

    // Parse Resend's structured error ({ statusCode, message, name }) so we can
    // categorize accurately instead of lumping everything under "auth failed".
    let resendName = '';
    let resendMessage = '';
    try {
      const parsed = JSON.parse(body) as { name?: string; message?: string };
      resendName = parsed.name ?? '';
      resendMessage = parsed.message ?? '';
    } catch {
      /* body wasn't JSON — fall through to generic handling */
    }

    // 403 validation errors (e.g. sending from an unverified domain) are NOT
    // authentication failures. Reporting them as such sends admins chasing the
    // API key when the real fix is verifying the sender domain / FROM_EMAIL.
    const isDomainNotVerified =
      resendName === 'validation_error' || /domain is not verified/i.test(resendMessage);
    if (response.status === 403 && isDomainNotVerified) {
      throw new Error(
        `Resend rejected the sender: ${resendMessage || 'domain is not verified'} ` +
          '(FROM_EMAIL must use a domain verified at https://resend.com/domains, ' +
          "or Resend's shared sender onboarding@resend.dev)."
      );
    }

    // 401 (and other 403s) indicate a genuine key/permission problem.
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        `Resend API authentication failed (${response.status}): ${resendMessage || body}. ` +
          'Your RESEND_API_KEY may be invalid, expired, or lack permission. ' +
          'Check https://resend.com/api-keys for a valid key.'
      );
    }
    throw new Error(`Resend API error (${response.status}): ${resendMessage || body}`);
  }

  return (await response.json()) as { id: string };
}

/**
 * Send a magic link email to the user.
 */
export async function sendMagicLinkEmail(email: string, magicLinkUrl: string): Promise<void> {
  const subject = 'Sign in to Filmora Movie';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:480px;background:#16161f;border-radius:12px;padding:40px 32px;">
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <div style="display:inline-flex;align-items:center;gap:8px;">
                <div style="width:32px;height:32px;background:linear-gradient(135deg,#6366f1,#a855f7);border-radius:8px;display:flex;align-items:center;justify-content:center;">
                  <span style="color:#fff;font-size:14px;">▶</span>
                </div>
                <span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:-0.3px;">Filmora</span>
              </div>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom:16px;">
              <h1 style="margin:0;color:#fff;font-size:22px;font-weight:600;">Sign in to your account</h1>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <p style="margin:0;color:#9ca3af;font-size:14px;line-height:1.6;">
                Click the button below to securely sign in. This link expires in 10 minutes and can only be used once.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <a href="${magicLinkUrl}"
                 style="display:inline-block;background:linear-gradient(135deg,#6366f1,#a855f7);color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 32px;border-radius:8px;letter-spacing:0.2px;">
                Sign in to Filmora
              </a>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <p style="margin:0;color:#6b7280;font-size:12px;line-height:1.5;">
                If the button doesn't work, copy and paste this URL into your browser:
              </p>
              <p style="margin:8px 0 0;word-break:break-all;color:#818cf8;font-size:12px;">
                ${magicLinkUrl}
              </p>
            </td>
          </tr>
          <tr>
            <td align="center">
              <p style="margin:0;color:#4b5563;font-size:11px;">
                If you didn't request this email, you can safely ignore it.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  const text = `Sign in to Filmora Movie\n\nClick this link to sign in (expires in 10 minutes):\n${magicLinkUrl}\n\nIf you didn't request this, ignore this email.`;

  await sendEmail({ to: email, subject, html, text });
}
