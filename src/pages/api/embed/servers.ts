// src/pages/api/embed/servers.ts — how does each server look for this title?
//
// The player islands render EVERY server returned here, in the order given, and
// any of them can be selected. Probe results come back as flags (`online`,
// `verified`) instead of as a filter: a probe runs from a datacenter IP that
// these providers throttle, so a failed probe is not proof the stream is dead in
// the viewer's browser. Confirmed servers simply sort first.
//
//   GET /api/embed/servers?type=movie&id=550
//   GET /api/embed/servers?type=tv&id=2734&season=1&episode=1
//
// -> { servers: [{ id, name, label, verified, online, confidence }], count }
import type { APIRoute } from 'astro';
import { EMBED_SERVER_META, getAvailableServers, type EmbedTarget } from '../../../lib/embed';

export const prerender = false;

const isDigits = (v: string | null): v is string => !!v && /^\d+$/.test(v);

/** Unprobed server list, used when the probe pass itself blows up. */
const UNPROBED = EMBED_SERVER_META.map((m) => ({
  id: m.id,
  name: m.name,
  label: m.label,
  confidence: m.confidence,
  online: false,
  verified: false,
}));

export const GET: APIRoute = async ({ url }) => {
  const type = url.searchParams.get('type');
  const id = url.searchParams.get('id');

  if (!isDigits(id) || (type !== 'movie' && type !== 'tv')) {
    return Response.json(
      { error: 'Invalid type/id', servers: UNPROBED, count: UNPROBED.length },
      { status: 400 }
    );
  }

  let target: EmbedTarget;
  if (type === 'movie') {
    target = { kind: 'movie', id };
  } else {
    const season = url.searchParams.get('season');
    const episode = url.searchParams.get('episode');
    if (!isDigits(season) || !isDigits(episode)) {
      return Response.json(
        {
          error: 'season and episode are required for type=tv',
          servers: UNPROBED,
          count: UNPROBED.length,
        },
        { status: 400 }
      );
    }
    target = { kind: 'tv', id, season, episode };
  }

  try {
    const servers = await getAvailableServers(target);
    return Response.json(
      { servers, count: servers.length },
      {
        headers: {
          // Short cache: availability changes, but repeat visits within a
          // browsing session should not re-probe every provider.
          'Cache-Control': 'public, max-age=300, s-maxage=600',
        },
      }
    );
  } catch {
    // Probing failed wholesale (network, config). Still hand back the server
    // list so the viewer keeps every button — just without confirmation marks.
    return Response.json(
      { servers: UNPROBED, count: UNPROBED.length, probed: false },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }
};
