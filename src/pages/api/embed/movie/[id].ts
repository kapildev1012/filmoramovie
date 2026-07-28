// src/pages/api/embed/movie/[id].ts — Movie embed proxy.
//
// The iframe points at this same-origin route; we resolve the real provider URL
// on the server and 302 there, so EMBED_API_KEY never reaches the browser.
//
// Behaviour: the requested server always wins. A backend probe still runs to
// resolve the best URL, but a probe that fails no longer blocks playback — the
// provider's own player URL is used instead, so every server button works.
//
// Query params:
//   ?server=nexstream|vidlink|videasy|vidfast  (optional preference)
import type { APIRoute } from 'astro';
import { normalizeServer, resolveEmbedUrl } from '../../../../lib/embed';

export const prerender = false;

/** Shown inside the iframe only when streaming is misconfigured server-side. */
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
  const id = params.id;
  if (!id || !/^\d+$/.test(id)) {
    return new Response('Invalid movie id', { status: 400 });
  }

  // null when absent/unknown (e.g. a retired provider saved in localStorage) —
  // resolveEmbedUrl then picks the strongest server itself.
  const requested = normalizeServer(url.searchParams.get('server'));

  let resolved: Awaited<ReturnType<typeof resolveEmbedUrl>>;
  try {
    resolved = await resolveEmbedUrl({ kind: 'movie', id }, requested);
  } catch {
    return unavailableResponse(500, 'Streaming is not configured.');
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: resolved.url,
      // Which server actually served it, so the client can reflect reality.
      'X-Embed-Server': resolved.server,
      // Whether that URL came from a confirmed probe.
      'X-Embed-Confirmed': resolved.confirmed ? '1' : '0',
      // Never let a shared cache store a redirect that may embed a key.
      'Cache-Control': 'private, no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
};
