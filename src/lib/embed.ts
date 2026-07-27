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

/** CodeSpecter API base URL (resolves a direct source URL for a TMDB id). */
export const EMBED_BASE = 'https://api.codespecters.com';

/** TMDB poster/thumbnail image base (w300). */
export const IMG_BASE = 'https://image.tmdb.org/t/p/w300';

/** TMDB large image base (w780). */
export const IMG_BASE_LG = 'https://image.tmdb.org/t/p/w780';

/** Brand accent passed to providers that support theming (hex, no '#'). */
const ACCENT = 'e50914';

/** Identifier for a streaming server/source. */
export type EmbedServerId = 'nexstream' | 'vidlink' | 'videasy' | 'vidfast';

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
  { id: 'nexstream', name: 'NexStream', label: 'Server 1', confidence: 'title' },
  { id: 'vidlink', name: 'VidLink', label: 'Server 2', confidence: 'title' },
  { id: 'videasy', name: 'Videasy', label: 'Server 3', confidence: 'live' },
  { id: 'vidfast', name: 'VidFast', label: 'Server 4', confidence: 'live' },
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
  const isMovie = target.kind === 'movie';
  const { id } = target;
  const s = isMovie ? '' : String((target as Extract<EmbedTarget, { kind: 'tv' }>).season);
  const e = isMovie ? '' : String((target as Extract<EmbedTarget, { kind: 'tv' }>).episode);

  switch (server) {
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

const PROBE_TIMEOUT_MS = 6000;
/** Positive answers are cached so switching servers is instant. */
const PROBE_TTL_MS = 10 * 60 * 1000;
/**
 * Negative answers expire fast. A probe runs from the server (Cloudflare /
 * datacenter IP) and these providers frequently rate-limit or 403 that traffic
 * even though the same request works from the viewer's browser — so "no" is a
 * weak signal that must not disable a button for ten minutes.
 */
const PROBE_NEGATIVE_TTL_MS = 45 * 1000;
const _probeCache = new Map<string, { expires: number; url: string | null }>();
const PROBE_CACHE_MAX = 800;

function cacheKey(server: EmbedServerId, target: EmbedTarget): string {
  return target.kind === 'movie'
    ? `${server}:movie:${target.id}`
    : `${server}:tv:${target.id}:${target.season}:${target.episode}`;
}

function cacheSet(key: string, url: string | null): void {
  if (_probeCache.size >= PROBE_CACHE_MAX) {
    const oldest = _probeCache.keys().next().value;
    if (oldest !== undefined) _probeCache.delete(oldest);
  }
  _probeCache.set(key, {
    expires: Date.now() + (url ? PROBE_TTL_MS : PROBE_NEGATIVE_TTL_MS),
    url,
  });
}

async function fetchWithTimeout(url: string, attempt = 0): Promise<Response> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), PROBE_TIMEOUT_MS);
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
    // One retry: these providers drop the occasional connection, and a single
    // hiccup must not remove a working server from the list.
    if (attempt === 0) return fetchWithTimeout(url, 1);
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
  const key = cacheKey(server, target);
  const hit = _probeCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.url;

  let resolved: string | null = null;

  try {
    if (server === 'nexstream') {
      // 'title' confidence. CodeSpecter returns success:true and a templated
      // vidking URL for ANY id — including 99999999 — so `sources` proves
      // nothing. `meta` is null for ids it cannot resolve, so that is the only
      // usable signal.
      const res = await fetchWithTimeout(codespecterApiUrl(target));
      if (res.ok) {
        const data = (await res.json()) as CodespecterResponse;
        const url = data.success ? data.sources?.find((s) => s.url)?.url : undefined;
        if (url && data.meta?.title) resolved = url;
      }
    } else if (server === 'vidlink') {
      // 'title' confidence: vidlink answers 5xx for ids it does not know and
      // 200 for ones it does.
      const url = providerUrl(server, target);
      const res = await fetchWithTimeout(url);
      if (res.ok) resolved = url;
    } else {
      // 'live' confidence: these players respond identically for real and bogus
      // ids, so all we can honestly verify is that the provider is up and
      // serving its player for this request.
      const url = providerUrl(server, target);
      const res = await fetchWithTimeout(url);
      if (res.ok) resolved = url;
    }
  } catch {
    resolved = null; // timeout / network / abort -> treat as unavailable
  }

  cacheSet(key, resolved);
  return resolved;
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
}

const CONFIDENCE_RANK: Record<ProbeConfidence, number> = { title: 0, live: 1 };

/**
 * Probe every provider in parallel and describe all of them.
 *
 * Every server is always returned, because a server-side probe is only advice:
 * it runs from a datacenter IP that providers throttle, so a failed probe often
 * means "we could not check", not "this will not play". Omitting the button
 * would take away a server that works fine in the viewer's browser. Instead the
 * probe result rides along as `online` / `verified`, and the ones we confirmed
 * are sorted first and marked in the UI. Selecting any server always plays.
 */
export async function getAvailableServers(target: EmbedTarget): Promise<AvailableServer[]> {
  const results = await Promise.all(
    EMBED_SERVER_META.map(async (meta) => {
      const url = await probeServer(meta.id, target).catch(() => null);
      return {
        id: meta.id,
        name: meta.name,
        label: meta.label,
        confidence: meta.confidence,
        online: url !== null,
        verified: url !== null && meta.confidence === 'title',
      };
    })
  );

  // Confirmed servers first, then by how strong their check can ever be.
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
