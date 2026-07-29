import { defineMiddleware } from 'astro:middleware';

const PUBLIC_PAGE = /^(?:\/(?:movies|series|anime|netflix|prime|disney|hotstar|appletv|search)\/?|\/(?:movie|series)\/\d+\/?)$/;

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

/** Check if we're running on Cloudflare (has edge cache + cfContext). */
function isCloudflare(): boolean {
  return typeof caches !== 'undefined' && import.meta.env.DEPLOY_TARGET !== 'vercel';
}

export const onRequest = defineMiddleware(async ({ request, url, locals }, next) => {
  const isGet = request.method === 'GET' || request.method === 'HEAD';
  const isAuthenticated = (request.headers.get('cookie') ?? '').includes('filmora_session=');

  if (!isGet || isAuthenticated || !isPublicCatalogPage(url.pathname)) {
    return next();
  }

  // Never cache HTML while developing. Miniflare persists `caches.default` to
  // .wrangler/state between runs, so a dev-time entry survived server restarts
  // and an edit could stay invisible on exactly these routes.
  if (import.meta.env.DEV) {
    return next();
  }

  // Edge caching is Cloudflare-only. On Vercel the CDN handles caching via
  // Cache-Control headers, so we skip the manual cache read/write entirely.
  const useEdgeCache = isCloudflare();

  type EdgeCacheStorage = CacheStorage & { default: Cache };
  const edgeCache = useEdgeCache
    ? (caches as EdgeCacheStorage).default
    : null;

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

  if (edgeCache && request.method === 'GET' && locals.cfContext) {
    const cacheWrite = edgeCache.put(cacheKey, response.clone());
    locals.cfContext.waitUntil(cacheWrite);
  }

  return response;
});
