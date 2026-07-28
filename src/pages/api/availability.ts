// src/pages/api/availability.ts — legal "where to watch" + audio languages.
//
// GET /api/availability?type=movie&id=19995[&country=in]
// GET /api/availability?type=tv&id=94997[&country=in]
//
// The browser cannot call streaming-availability.p.rapidapi.com itself: the key
// is a server-only secret and the upstream sends no CORS headers. This route is
// the same-origin bridge — it returns only the normalised shape from
// src/lib/streamingAvailability.ts, which contains no credentials.
//
// Always 200 with a JSON body. An unconfigured key or an upstream failure comes
// back as `{ availability: null }` rather than an error status, because the
// caller's job is to hide a UI section, not to surface a fault.
import type { APIRoute } from 'astro';
import {
  DEFAULT_COUNTRY,
  getAvailability,
  type AvailabilityTarget,
} from '../../lib/streamingAvailability';

export const prerender = false;

function bad(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export const GET: APIRoute = async ({ url }) => {
  const params = url.searchParams;
  const type = params.get('type') === 'tv' ? 'tv' : 'movie';
  const id = params.get('id') ?? '';
  if (!/^\d+$/.test(id)) return bad('Invalid id');

  // Two letters only — this lands in the upstream query string, so validate
  // rather than forwarding arbitrary caller input.
  const raw = (params.get('country') ?? DEFAULT_COUNTRY).toLowerCase();
  const country = /^[a-z]{2}$/.test(raw) ? raw : DEFAULT_COUNTRY;

  const target: AvailabilityTarget = { kind: type, id };
  const availability = await getAvailability(target, country).catch(() => null);

  return new Response(JSON.stringify({ availability }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      // Availability moves on the order of days; a shared cache here also
      // shields the metered RapidAPI quota from repeat views.
      'Cache-Control': 'public, max-age=1800, stale-while-revalidate=86400',
    },
  });
};
