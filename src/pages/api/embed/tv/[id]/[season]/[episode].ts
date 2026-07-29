// src/pages/api/embed/tv/[id]/[season]/[episode].ts — TV episode embed proxy.
//
// Same contract as the movie route: resolve the provider server-side, 302 to it,
// keep EMBED_API_KEY off the client. The requested server always wins, so when
// one is requested we 302 straight to its player WITHOUT probing — the probe
// only ever added latency to a decision that was already made. It still runs, as
// advice, when we have to choose the server ourselves.
//
// Query params:
//   ?server=nexstream|vidlink|videasy|vidfast  (optional preference)
import type { APIRoute } from 'astro';
import { normalizeServer, resolveEmbedUrl, tvEmbedUrl } from '../../../../../../lib/embed';

export const prerender = false;

function unavailableResponse(status: number, message: string): Response {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Unavailable</title><style>
html,body{height:100%;margin:0;background:#0b0b0f;color:#e8e8ea;
font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
display:flex;align-items:center;justify-content:center;text-align:center}
div{max-width:32rem;padding:1.5rem}p{margin:.35rem 0;color:#a1a1aa}
strong{color:#fff;font-size:1.05rem}</style></head>
<body><div><strong>${message}</strong>
<p>Try another server from the buttons below the player.</p></div></body></html>`,
    {
      status,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    }
  );
}

export const GET: APIRoute = async ({ params, url }) => {
  const { id, season, episode } = params;
  if (
    !id || !/^\d+$/.test(id) ||
    !season || !/^\d+$/.test(season) ||
    !episode || !/^\d+$/.test(episode)
  ) {
    return new Response('Invalid tv/season/episode id', { status: 400 });
  }

  const requested = normalizeServer(url.searchParams.get('server'));

  // FAST PATH: a chosen server wins whether or not a probe would confirm it, so
  // skip the probe and redirect straight to the provider's player. Removes the
  // probe round-trip (up to several seconds cold) from the first frame.
  if (requested) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: tvEmbedUrl(id, season, episode, requested),
        'X-Embed-Server': requested,
        'X-Embed-Confirmed': '0',
        'Cache-Control': 'private, no-store',
        'Referrer-Policy': 'no-referrer',
      },
    });
  }

  let resolved: Awaited<ReturnType<typeof resolveEmbedUrl>>;
  try {
    resolved = await resolveEmbedUrl({ kind: 'tv', id, season, episode }, requested);
  } catch {
    return unavailableResponse(500, 'Streaming is not configured.');
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: resolved.url,
      'X-Embed-Server': resolved.server,
      'X-Embed-Confirmed': resolved.confirmed ? '1' : '0',
      'Cache-Control': 'private, no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
};
