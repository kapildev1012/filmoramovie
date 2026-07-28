// src/pages/api/embed/probe.ts — status-only pre-flight probe for the player.
//
// WHY THIS EXISTS
// The browser cannot check a provider itself. A cross-origin `fetch` is blocked
// by CORS, and `mode: 'no-cors'` returns an opaque response whose status is
// always 0 — so a 404 and a working page are indistinguishable from the client.
// This same-origin route does the request from the server and hands back the
// REAL status code, which is the only way the player can tell:
//
//   • 404 / 410  → this provider genuinely does not have this title. Skip it.
//   • 403 / 429  → the provider throttled our datacenter IP. Says nothing about
//                  the viewer's browser, so the server stays usable.
//   • network    → unreachable. Skip it.
//
// The result is advice with a known confidence, not a gate: see
// src/lib/player/embedProbe.ts for how the client turns these verdicts into a
// pick, and src/lib/embed.ts for why a failed probe must never remove a button.
//
// SECURITY: only opaque server ids go in and out. No provider URLs, no
// EMBED_API_KEY — the key never leaves the server (lib/embed.ts is server-only).
//
// GET /api/embed/probe?type=movie&id=550
// GET /api/embed/probe?type=tv&id=1399&season=1&episode=1[&servers=vidlink,vidfast]
import type { APIRoute } from 'astro';
import {
  EMBED_SERVER_META,
  normalizeServer,
  probeServerStatus,
  type EmbedServerId,
  type EmbedTarget,
} from '../../../lib/embed';

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

  const target: EmbedTarget =
    type === 'tv'
      ? {
          kind: 'tv',
          id,
          season: Number(params.get('season') ?? 1) || 1,
          episode: Number(params.get('episode') ?? 1) || 1,
        }
      : { kind: 'movie', id };

  // A caller may narrow the probe to the servers it actually intends to use
  // (the player probes its own ranked shortlist, not always all four).
  const requested = (params.get('servers') ?? '')
    .split(',')
    .map((s) => normalizeServer(s.trim()))
    .filter((s): s is EmbedServerId => s !== null);
  const list = requested.length > 0 ? requested : EMBED_SERVER_META.map((m) => m.id);

  // Parallel: the whole point is to answer inside one play-tap's worth of time.
  const confidenceOf = new Map(EMBED_SERVER_META.map((m) => [m.id, m.confidence]));
  const results = await Promise.all(
    list.map((server) =>
      probeServerStatus(server, target)
        .catch(() => ({
          server,
          verdict: 'unreachable' as const,
          status: null,
          latencyMs: null,
        }))
        // How much a status is worth differs per provider: a 'title'-confidence
        // provider answers differently for ids it does not know (VidLink 5xx,
        // CodeSpecter null meta), so its error status is real evidence about THIS
        // title. A 'live'-confidence provider answers identically for real and
        // bogus ids, so only 404/unreachable mean anything. The client needs this
        // to decide which verdicts may disqualify a server — see embedProbe.ts.
        .then((result) => ({ ...result, confidence: confidenceOf.get(server) ?? 'live' }))
    )
  );

  return new Response(JSON.stringify({ results }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      // Short private cache: a viewer flicking through episodes re-probes
      // constantly, but a stale "missing" must not outlive a provider fixing
      // its library.
      'Cache-Control': 'private, max-age=30',
    },
  });
};
