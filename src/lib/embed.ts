// src/lib/embed.ts — Streaming provider config + backend availability checks.
//
// DESIGN (probe = advice, not a gate)
// -----------------------------------
// Every provider we know about is always offered to the viewer. Before playing
// we still probe the providers for the *specific* title, but the result is only
// advice: probes run from a datacenter IP that these providers throttle or 403,
// so "probe failed" regularly means "could not check" rather than "will not
// play" — the same URL usually plays fine in the viewer's browser. Removing the
// button on that evidence would take away a working server, so instead the
// result rides along as `online` / `verified`, confirmed servers sort first, and
// picking any server always loads a real player (see `resolveEmbedUrl`).
//
// HOW STRONG IS EACH CHECK?
// Providers render their player in JavaScript, so no server-side check can
// prove a stream will play. Each provider declares the best its probe can do:
//   'title'  — provider demonstrably recognises this exact TMDB title. For
//              CodeSpecter that means its JSON API returned real `meta` (it
//              templates `sources` for any id, including nonexistent ones, so
//              only `meta` is evidence); for VidLink it means a 2xx where
//              unknown ids give 5xx. A recognised title still does not
//              guarantee a working stream.
//   'live'   — provider is reachable and serves its player, but responds
//              identically for real and bogus ids, so per-title availability is
//              unknowable from the server. The player island upgrades these to
//              confirmed at runtime when the frame reports playback.
// Nothing is labelled by stream availability, because that is only knowable in
// the browser — the player marks a server "playing" once the frame says so.
//
// SECURITY: EMBED_API_KEY is a server-only secret read from astro:env/server.
// This module must never be imported into client code — the React player
// islands only ever reference the opaque `id` values and call the /api/embed
// routes, which resolve the real provider URL on the server.

import { EMBED_API_KEY as EMBED_API_KEY_ENV } from 'astro:env/server';
import { qualityFor, qualityLabel } from './player/serverRanking';

/** CodeSpecter API base URL (resolves a direct source URL for a TMDB id). */
export const EMBED_BASE = 'https://api.codespecters.com';

/** TMDB poster/thumbnail image base (w300). */
export const IMG_BASE = 'https://image.tmdb.org/t/p/w300';

/** TMDB large image base (w780). */
export const IMG_BASE_LG = 'https://image.tmdb.org/t/p/w780';

/** Brand accent passed to providers that support theming (hex, no '#'). */
const ACCENT = 'e50914';

/**
 * BEST-EFFORT "start at the highest rendition" hints appended to every provider
 * URL.
 *
 * HONESTY: none of the four providers publishes a documented quality parameter,
 * so these are conventions borrowed from the player libraries their pages are
 * built on (player.js / JW / Plyr wrappers commonly read `quality`, and several
 * embed front-ends read `hd`). A provider that does not recognise them ignores
 * them — an unknown query param cannot break a page — and the real mechanism is
 * the postMessage burst in adapters/embed.ts. Set QUALITY_HINTS_ENABLED to false
 * to stop sending them entirely; nothing else depends on them.
 *
 * `max` rather than `1080`: pinning a number would CAP a 4K title at 1080p, which
 * is the opposite of what the product wants.
 */
const QUALITY_HINTS_ENABLED = true;
const QUALITY_HINTS = 'quality=max&hd=1';

/** Append the shared quality hints to a provider URL that already has a query. */
function withQualityHints(url: string): string {
  if (!QUALITY_HINTS_ENABLED) return url;
  return `${url}${url.includes('?') ? '&' : '?'}${QUALITY_HINTS}`;
}

/** Identifier for a streaming server/source. */
export type EmbedServerId = 'vidsrcin' | 'nexstream' | 'vidlink' | 'videasy' | 'vidfast';

/** How trustworthy a provider's availability probe can be. */
export type ProbeConfidence = 'title' | 'live';

/** What we want to play. */
export type EmbedTarget =
  | { kind: 'movie'; id: number | string }
  | { kind: 'tv'; id: number | string; season: number | string; episode: number | string };

/**
 * Client-safe metadata about each streaming server. Contains NO secrets and no
 * provider URLs — just id, display name and probe confidence — so it is safe to
 * send to the browser via /api/embed/servers.
 */
export const EMBED_SERVER_META: ReadonlyArray<{
  id: EmbedServerId;
  name: string;
  label: string;
  confidence: ProbeConfidence;
}> = [
  // Declared in curated ad-cleanliness / reliability priority (see
  // PROVIDER_PREFERENCE in serverRanking.ts) so the "Server 1..4" labels and the
  // registry-order tie-break both read best-first. The authoritative auto-pick
  // is still made by rankServers(), which folds in real playback evidence.
  { id: 'vidsrcin', name: 'VidSrc IN (Hindi)', label: 'Server 1', confidence: 'title' },
  { id: 'vidlink', name: 'VidLink', label: 'Server 2', confidence: 'title' },
  { id: 'vidfast', name: 'VidFast', label: 'Server 3', confidence: 'live' },
  { id: 'videasy', name: 'Videasy', label: 'Server 4', confidence: 'live' },
  { id: 'nexstream', name: 'NexStream', label: 'Server 5', confidence: 'title' },
];

const VALID_SERVERS = new Set<string>(EMBED_SERVER_META.map((s) => s.id));

/**
 * Narrow an arbitrary string to a known EmbedServerId, or null.
 *
 * Returns null (rather than a default) for unknown values so callers must
 * consult {@link getAvailableServers}. Old saved Continue-Watching entries may
 * still name retired providers ('vidsrc', '2embed'); those resolve to null and
 * the caller falls back to the best available server.
 */
export function normalizeServer(server: string | null | undefined): EmbedServerId | null {
  return server && VALID_SERVERS.has(server) ? (server as EmbedServerId) : null;
}

/** Server-only CodeSpecter API key. Throws if unset so misconfig fails loudly. */
export function getEmbedApiKey(): string {
  const key = EMBED_API_KEY_ENV;
  if (!key) {
    throw new Error('EMBED_API_KEY environment variable is not set.');
  }
  return key;
}

// ─── Provider URL builders ────────────────────────────────────────────────────
// Retired providers and why (both were hurting playback, not helping it):
//   • vidsrc.to — served a 2.5KB shell that injects a third-party ad tag
//     (llvpn.com/tag.min.js) and iframes vsembed.ru. Pure ad vector.
//   • 2embed.cc — ad-heavy wrapper, no availability signal at all.

/** Direct player URL for a provider, given a target. Never includes secrets. */
function providerUrl(server: EmbedServerId, target: EmbedTarget): string {
  return withQualityHints(providerUrlBase(server, target));
}

function providerUrlBase(server: EmbedServerId, target: EmbedTarget): string {
  const isMovie = target.kind === 'movie';
  const { id } = target;
  const s = isMovie ? '' : String((target as Extract<EmbedTarget, { kind: 'tv' }>).season);
  const e = isMovie ? '' : String((target as Extract<EmbedTarget, { kind: 'tv' }>).episode);

  switch (server) {
    case 'vidsrcin':
      return isMovie
        ? `https://vidsrc.in/embed/movie/${id}`
        : `https://vidsrc.in/embed/tv/${id}/${s}/${e}`;
    case 'vidlink':
      return isMovie
        ? `https://vidlink.pro/movie/${id}?primaryColor=${ACCENT}&autoplay=true&title=false`
        : `https://vidlink.pro/tv/${id}/${s}/${e}?primaryColor=${ACCENT}&autoplay=true&nextbutton=true`;
    case 'videasy':
      return isMovie
        ? `https://player.videasy.net/movie/${id}?color=${ACCENT}`
        : `https://player.videasy.net/tv/${id}/${s}/${e}?color=${ACCENT}&nextEpisode=true&episodeSelector=true`;
    case 'vidfast':
      return isMovie
        ? `https://vidfast.pro/movie/${id}?theme=${ACCENT}&autoPlay=true`
        : `https://vidfast.pro/tv/${id}/${s}/${e}?theme=${ACCENT}&autoPlay=true&nextButton=true`;
    case 'nexstream':
      // NEVER point at CodeSpecter's own /embed page: that URL carries
      // ?apikey=, and the browser would see it in the 302 Location header.
      // The JSON API resolves to a NexStream (vidking) player URL, so when the
      // API is unreachable we build that same player URL ourselves. Key stays
      // server-side, and the button keeps working.
      return isMovie
        ? `https://www.vidking.net/embed/movie/${id}?color=${ACCENT}&autoPlay=true`
        : `https://www.vidking.net/embed/tv/${id}/${s}/${e}?color=${ACCENT}&autoPlay=true&nextEpisode=true&episodeSelector=true`;
  }
}

/**
 * Public wrapper around {@link providerUrl} for callers that need the provider's
 * own player URL without running a probe (the status probe below, and the
 * back-compat helpers at the bottom of this file). Server-only: it must not be
 * imported into client code, because this module reads EMBED_API_KEY.
 */
export function providerPlayerUrl(server: EmbedServerId, target: EmbedTarget): string {
  return providerUrl(server, target);
}

/**
 * Verdict for one provider, one title — the honest translation of an HTTP
 * status into "should the player send a viewer here?".
 *
 *   'ok'          2xx/3xx: the provider served its player document.
 *   'missing'     404 / 410: this provider does not have this title. HARD fail.
 *   'blocked'     401 / 403 / 429: the provider refused OUR ip (datacenter
 *                 throttling). Proves nothing about the viewer's browser, so it
 *                 is not a failure — only a demotion.
 *   'error'       5xx.
 *   'unreachable' DNS / TCP / TLS failure or our timeout. HARD fail.
 */
export type ProbeVerdict = 'ok' | 'missing' | 'blocked' | 'error' | 'unreachable';

export interface ServerProbeResult {
  server: EmbedServerId;
  verdict: ProbeVerdict;
  /** HTTP status, or null when the request never got an answer. */
  status: number | null;
  latencyMs: number | null;
}

function verdictFor(status: number): ProbeVerdict {
  if (status >= 200 && status < 400) return 'ok';
  if (status === 404 || status === 410) return 'missing';
  if (status === 401 || status === 403 || status === 429) return 'blocked';
  return 'error';
}

/**
 * Status-only probe of one provider for one title.
 *
 * HEAD first (cheapest possible question: "does this document exist?"), then a
 * GET when the provider does not implement HEAD — several of them answer 405 or
 * 501 to HEAD while serving the same URL happily on GET, and treating that as a
 * dead server would take a working provider away from the viewer.
 *
 * Unlike {@link probeServerTimed} this reports the raw status, so the browser can
 * tell "this title is genuinely 404 here" (skip the server) apart from "the
 * provider throttled our datacenter" (keep the server, just rank it lower).
 */
export async function probeServerStatus(
  server: EmbedServerId,
  target: EmbedTarget
): Promise<ServerProbeResult> {
  const url = providerUrl(server, target);
  const startedAt = Date.now();

  const attempt = async (method: 'HEAD' | 'GET'): Promise<Response> => {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), PROBE_TIMEOUT_MS);
    try {
      return await fetch(url, {
        method,
        signal: ac.signal,
        redirect: 'follow',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
        },
      });
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    let res = await attempt('HEAD');
    // 405/501 (and the odd 400) mean "wrong method", not "no such title".
    if (res.status === 405 || res.status === 501 || res.status === 400) {
      res = await attempt('GET');
    }
    return {
      server,
      verdict: verdictFor(res.status),
      status: res.status,
      latencyMs: Date.now() - startedAt,
    };
  } catch {
    return { server, verdict: 'unreachable', status: null, latencyMs: null };
  }
}

/** CodeSpecter JSON endpoint that resolves a real source URL for a target. */
function codespecterApiUrl(target: EmbedTarget): string {
  const key = getEmbedApiKey();
  if (target.kind === 'movie') {
    return `${EMBED_BASE}/api/movie/${target.id}?apikey=${key}`;
  }
  return `${EMBED_BASE}/api/tv/${target.id}/${target.season}/${target.episode}?apikey=${key}`;
}

interface CodespecterResponse {
  success?: boolean;
  /** null when CodeSpecter cannot resolve the id — the only real evidence. */
  meta?: { title?: string; poster?: string } | null;
  sources?: Array<{ name?: string; url?: string }>;
  error?: string;
}

// ─── Availability probing ─────────────────────────────────────────────────────

const PROBE_TIMEOUT_MS = 4000;
/** Positive answers are cached so switching servers is instant. */
const PROBE_TTL_MS = 10 * 60 * 1000;
/**
 * Negative answers expire fast. A probe runs from the server (Cloudflare /
 * datacenter IP) and these providers frequently rate-limit or 403 that traffic
 * even though the same request works from the viewer's browser — so "no" is a
 * weak signal that must not disable a button for ten minutes.
 */
const PROBE_NEGATIVE_TTL_MS = 45 * 1000;
/**
 * The probe result now carries how long the provider took to answer. That is a
 * real, measured number (unlike resolution, which is unknowable from here — see
 * src/lib/player/serverRanking.ts), and it is the last tie-break the player uses
 * when choosing a server automatically: between two providers that both
 * recognise a title and have never failed, the faster one wins.
 */
const _probeCache = new Map<string, { expires: number; url: string | null; latencyMs: number | null }>();
const PROBE_CACHE_MAX = 800;

function cacheKey(server: EmbedServerId, target: EmbedTarget): string {
  return target.kind === 'movie'
    ? `${server}:movie:${target.id}`
    : `${server}:tv:${target.id}:${target.season}:${target.episode}`;
}

function cacheSet(key: string, url: string | null, latencyMs: number | null): void {
  if (_probeCache.size >= PROBE_CACHE_MAX) {
    const oldest = _probeCache.keys().next().value;
    if (oldest !== undefined) _probeCache.delete(oldest);
  }
  _probeCache.set(key, {
    expires: Date.now() + (url ? PROBE_TTL_MS : PROBE_NEGATIVE_TTL_MS),
    url,
    latencyMs,
  });
}

async function fetchWithTimeout(url: string, attempt = 0): Promise<Response> {
  const ac = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ac.abort();
  }, PROBE_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: ac.signal,
      redirect: 'follow',
      headers: {
        // Some providers 403 requests without a browser-ish UA.
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
      },
    });
  } catch (err) {
    // One retry for a transient connection drop — but NOT when our own timeout
    // fired. Retrying a timeout would double the worst-case wait, and with it
    // the time "Auto" needs to confirm a server; the seeded pick already lets
    // playback start, so a slow provider is better left unconfirmed than chased.
    if (attempt === 0 && !timedOut) return fetchWithTimeout(url, 1);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Check one provider for one title.
 *
 * Resolves to the playable URL when the provider is ready, or null when it is
 * not (unreachable, unknown title, or no source). Results are cached.
 */
export async function probeServer(
  server: EmbedServerId,
  target: EmbedTarget
): Promise<string | null> {
  return (await probeServerTimed(server, target)).url;
}

/**
 * Same probe, but also reports how long it took.
 *
 * The duration is measured around the actual network call, so it reflects the
 * provider's real responsiveness from our edge. Cached entries replay the
 * latency they were measured with rather than reporting a fake ~0ms, otherwise
 * the ranking would think a cached server is infinitely fast.
 */
export async function probeServerTimed(
  server: EmbedServerId,
  target: EmbedTarget
): Promise<{ url: string | null; latencyMs: number | null }> {
  const key = cacheKey(server, target);
  const hit = _probeCache.get(key);
  if (hit && hit.expires > Date.now()) return { url: hit.url, latencyMs: hit.latencyMs };

  let resolved: string | null = null;
  const startedAt = Date.now();
  let latencyMs: number | null = null;

  try {
    if (server === 'nexstream') {
      // 'title' confidence. CodeSpecter returns success:true and a templated
      // vidking URL for ANY id — including 99999999 — so `sources` proves
      // nothing. `meta` is null for ids it cannot resolve, so that is the only
      // usable signal.
      //
      // AD / REDIRECT HARDENING: we use CodeSpecter's answer ONLY as the
      // title-recognition signal and then point the frame at NexStream's own
      // vidking player URL — a single, known host we can allowlist in the
      // page CSP and reason about — rather than the opaque `sources[].url`,
      // which can be any third-party CDN/ad host and cannot be pre-allowlisted.
      const res = await fetchWithTimeout(codespecterApiUrl(target));
      latencyMs = Date.now() - startedAt;
      if (res.ok) {
        const data = (await res.json()) as CodespecterResponse;
        const hasSource = data.success ? !!data.sources?.find((s) => s.url) : false;
        if (hasSource && data.meta?.title) resolved = providerUrl(server, target);
      }
    } else if (server === 'vidlink') {
      // 'title' confidence: vidlink answers 5xx for ids it does not know and
      // 200 for ones it does.
      const url = providerUrl(server, target);
      const res = await fetchWithTimeout(url);
      latencyMs = Date.now() - startedAt;
      if (res.ok) resolved = url;
    } else {
      // 'live' confidence: these players respond identically for real and bogus
      // ids, so all we can honestly verify is that the provider is up and
      // serving its player for this request.
      const url = providerUrl(server, target);
      const res = await fetchWithTimeout(url);
      latencyMs = Date.now() - startedAt;
      if (res.ok) resolved = url;
    }
  } catch {
    resolved = null; // timeout / network / abort -> treat as unavailable
    latencyMs = null; // no usable timing from a failed request
  }

  cacheSet(key, resolved, latencyMs);
  return { url: resolved, latencyMs };
}

export interface AvailableServer {
  id: EmbedServerId;
  name: string;
  label: string;
  /**
   * The provider demonstrably recognises this exact title (probe reached
   * 'title' confidence). NOT a promise that the stream plays — only the
   * browser can establish that.
   */
  verified: boolean;
  /** The provider answered our probe for this exact title. */
  online: boolean;
  confidence: ProbeConfidence;
  /**
   * Probe round-trip in ms, or null when the probe failed (a failed request
   * carries no usable timing). Measured, not estimated — the player uses it as
   * the final tie-break when auto-selecting a server.
   */
  latencyMs: number | null;
  /**
   * Declared best resolution / bitrate for this provider. Both are null today:
   * these values cannot be observed from outside the provider's cross-origin
   * player, so they must come from a curated registry or an out-of-band manifest
   * inspection service. See SERVER_QUALITY in src/lib/player/serverRanking.ts for
   * exactly what has to be supplied.
   */
  maxHeight: number | null;
  bitrateKbps: number | null;
  /** Badge text ("1080p"), or null while quality data is unavailable. */
  qualityLabel: string | null;
}

const CONFIDENCE_RANK: Record<ProbeConfidence, number> = { title: 0, live: 1 };

/**
 * Probe every provider in parallel and describe all of them.
 *
 * Every server is always returned, because a server-side probe is only advice:
 * it runs from a datacenter IP that providers throttle, so a failed probe often
 * means "we could not check", not "this will not play". Omitting the button
 * would take away a server that works fine in the viewer's browser. Instead the
 * probe result rides along as `online` / `verified` / `latencyMs`, and the
 * player's own ranking (src/lib/player/serverRanking.ts) turns those signals
 * into the automatic pick. Selecting any server always plays.
 */
export async function getAvailableServers(target: EmbedTarget): Promise<AvailableServer[]> {
  const results = await Promise.all(
    EMBED_SERVER_META.map(async (meta) => {
      const { url, latencyMs } = await probeServerTimed(meta.id, target).catch(() => ({
        url: null,
        latencyMs: null,
      }));
      const quality = qualityFor(meta.id);
      return {
        id: meta.id,
        name: meta.name,
        label: meta.label,
        confidence: meta.confidence,
        online: url !== null,
        verified: url !== null && meta.confidence === 'title',
        latencyMs,
        maxHeight: quality.maxHeight,
        bitrateKbps: quality.bitrateKbps,
        qualityLabel: qualityLabel(meta.id),
      };
    })
  );

  // Confirmed servers first, then by how strong their check can ever be. This is
  // only a sensible default order for rendering; the authoritative "which one do
  // we play" decision is made by rankServers() in the island, which also folds in
  // the reliability the browser has observed for itself.
  return results.sort(
    (a, b) =>
      Number(b.online) - Number(a.online) ||
      CONFIDENCE_RANK[a.confidence] - CONFIDENCE_RANK[b.confidence]
  );
}

/**
 * Resolve the URL to send the iframe to. Always returns a playable URL.
 *
 * `requested` always wins: if the viewer picked a server, they get that server
 * even when our probe could not confirm it (see {@link getAvailableServers} for
 * why a failed probe is not proof). Only when no server was requested do we
 * choose, preferring providers that answered. `confirmed` reports whether the
 * URL came from a successful probe so callers can be honest about it.
 */
export async function resolveEmbedUrl(
  target: EmbedTarget,
  requested: EmbedServerId | null
): Promise<{ url: string; server: EmbedServerId; confirmed: boolean }> {
  if (requested) {
    const url = await probeServer(requested, target).catch(() => null);
    if (url) return { url, server: requested, confirmed: true };
    // Unconfirmed: hand over the provider's own player URL and let the browser
    // decide. Never null — a button the user pressed must do something.
    return { url: providerUrl(requested, target), server: requested, confirmed: false };
  }

  const byConfidence = [...EMBED_SERVER_META].sort(
    (a, b) => CONFIDENCE_RANK[a.confidence] - CONFIDENCE_RANK[b.confidence]
  );

  for (const meta of byConfidence) {
    const url = await probeServer(meta.id, target).catch(() => null);
    if (url) return { url, server: meta.id, confirmed: true };
  }

  // Nothing answered — still play the strongest provider rather than showing a
  // dead frame; the player UI offers the other servers plus Reload.
  const fallback = byConfidence[0]!;
  return { url: providerUrl(fallback.id, target), server: fallback.id, confirmed: false };
}

// ─── Back-compat helpers ──────────────────────────────────────────────────────
// Kept so existing server-side callers keep compiling. These build a URL
// without checking availability — prefer resolveEmbedUrl().

/** Build a movie embed URL for a specific server (no availability check). */
export function movieEmbedUrl(tmdbId: number | string, server: EmbedServerId): string {
  return providerUrl(server, { kind: 'movie', id: tmdbId });
}

/** Build a TV episode embed URL for a specific server (no availability check). */
export function tvEmbedUrl(
  tmdbId: number | string,
  season: number | string,
  episode: number | string,
  server: EmbedServerId
): string {
  return providerUrl(server, { kind: 'tv', id: tmdbId, season, episode });
}
