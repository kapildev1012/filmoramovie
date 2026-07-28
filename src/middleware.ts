import { defineMiddleware } from 'astro:middleware';

// Routes whose HTML is identical for every visitor. Verified: none of these
// pages read `Astro.locals` or pass a `user` prop to Layout, so there is no
// per-visitor markup to leak. The static content pages (about/terms/privacy/
// contact) were previously missing, which meant they went out with no
// Cache-Control at all — so a prefetched copy could not be reused and clicking
// them paid a full round-trip. /profile, /watchlist and /login are deliberately
// absent: they are per-user or part of an auth flow.
const PUBLIC_PAGE = /^(?:\/(?:movies|series|anime|netflix|prime|disney|hotstar|appletv|search|about|terms|privacy|contact)\/?|\/(?:movie|series)\/\d+\/?)$/;

function isPublicCatalogPage(pathname: string): boolean {
  return pathname === '/' || PUBLIC_PAGE.test(pathname);
}

/**
 * Cache key for a page.
 *
 * The build fingerprint (`__BUILD_ID__`, injected by Vite — see
 * astro.config.mjs) is deliberately part of the key. `caches.default` outlives
 * the Worker that wrote to it, and responses go out with
 * `stale-while-revalidate=86400`, so HTML rendered by an older build could keep
 * being served for a day after a change shipped. Because only the routes matched
 * by PUBLIC_PAGE are cached, that showed up as "my new section appears on some
 * pages but not others" — /about was always fresh, /movies and /series/123 were
 * not. Keying by build makes it impossible: new code only ever reads entries its
 * own build wrote.
 */
function cacheKeyFor(url: URL, request: Request): Request {
  const key = new URL(url.href);
  key.searchParams.set('__b', __BUILD_ID__);
  return new Request(key.toString(), { method: 'GET', headers: request.headers });
}

export const onRequest = defineMiddleware(async ({ request, url, locals }, next) => {
  const isGet = request.method === 'GET' || request.method === 'HEAD';
  const isAuthenticated = (request.headers.get('cookie') ?? '').includes('filmora_session=');

  if (!isGet || !isPublicCatalogPage(url.pathname)) {
    return next();
  }

  // Never cache HTML while developing — for anyone, signed in or not. Miniflare
  // persists `caches.default` to .wrangler/state between runs, so a dev-time
  // entry survived server restarts and an edit could stay invisible on exactly
  // these routes.
  if (import.meta.env.DEV) {
    return next();
  }

  // ── Authenticated visitors ──
  // Never put their HTML in `caches.default`: that is a *shared* cache, and one
  // visitor's document must never be served to another. But the previous code
  // bailed out entirely, which meant the response carried no Cache-Control at
  // all — so the copy Astro had already prefetched was not reusable and every
  // navbar click paid a fresh SSR round-trip. `private` keeps the document in
  // the visitor's own browser cache only, which is exactly what the prefetch
  // needs, with no shared-cache exposure. `Vary: Cookie` stops any intermediary
  // from collapsing entries across sessions.
  if (isAuthenticated) {
    const rendered = await next();
    const contentType = rendered.headers.get('content-type') ?? '';
    if (!rendered.ok || !contentType.includes('text/html')) return rendered;

    const headers = new Headers(rendered.headers);
    headers.set('Cache-Control', 'private, max-age=30');
    headers.append('Vary', 'Cookie');
    return new Response(rendered.body, {
      status: rendered.status,
      statusText: rendered.statusText,
      headers,
    });
  }

  type EdgeCacheStorage = CacheStorage & { default: Cache };
  const edgeCache = typeof caches === 'undefined'
    ? null
    : (caches as EdgeCacheStorage).default;

  const cacheKey = cacheKeyFor(url, request);

  if (edgeCache) {
    const cached = await edgeCache.match(cacheKey);
    if (cached) return cached;
  }

  const rendered = await next();
  const contentType = rendered.headers.get('content-type') ?? '';
  if (!rendered.ok || !contentType.includes('text/html')) return rendered;

  const headers = new Headers(rendered.headers);
  headers.set('Cache-Control', 'public, max-age=30, s-maxage=300, stale-while-revalidate=86400');
  headers.set('Vary', 'Accept-Encoding');
  const response = new Response(rendered.body, {
    status: rendered.status,
    statusText: rendered.statusText,
    headers,
  });

  if (edgeCache && request.method === 'GET') {
    const cacheWrite = edgeCache.put(cacheKey, response.clone());
    locals.cfContext.waitUntil(cacheWrite);
  }

  return response;
});
