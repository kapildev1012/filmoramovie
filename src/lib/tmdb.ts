/**
 * TMDB API Client
 * Covers all endpoints needed for Filmora Movie.
 * API key must be set in TMDB_API_KEY environment variable.
 *
 * TMDB API docs: https://developer.themoviedb.org/docs
 */

import type {
  TMDBMovie,
  TMDBMovieBase,
  TMDBSeries,
  TMDBSeriesBase,
  TMDBSeason,
  TMDBCredits,
  TMDBVideosResponse,
  TMDBWatchProvidersResponse,
  TMDBPaginatedResponse,
  TMDBTrendingItem,
  TMDBGenreList,
  TMDBPersonBase,
  DiscoverMovieParams,
  DiscoverSeriesParams,
} from './types';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

// Runtime secret — resolved from the Cloudflare Worker env (or .env locally).
import { TMDB_API_KEY } from 'astro:env/server';

/** Get the full API key from env. Throws if missing. */
function getApiKey(): string {
  const key = TMDB_API_KEY;
  if (!key) {
    throw new Error('TMDB_API_KEY environment variable is not set.');
  }
  return key as string;
}

/** Build a TMDB image URL. Returns null if path is null. */
export function tmdbImage(
  path: string | null | undefined,
  size: 'w92' | 'w154' | 'w185' | 'w342' | 'w500' | 'w780' | 'original' = 'w500'
): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

/** Internal fetch helper with error handling and caching.
 *
 * Two caching layers make server-rendered navigation fast (<250ms):
 *  1. A module-level in-memory cache (per Worker isolate) memoises identical
 *     GET responses for `ttlSeconds`. Genres / trending / discover pages that
 *     repeat across navigations are served instantly without any network hop.
 *  2. Cloudflare's `cf.cacheTtl` / `cacheEverything` hint caches the upstream
 *     TMDB response at the edge, so even a cold isolate avoids a slow origin
 *     round-trip. (The legacy Next.js `next.revalidate` hint was a no-op here.)
 */
const _memCache = new Map<string, { expires: number; data: unknown }>();
const MEM_CACHE_MAX = 500;

// Network resilience tuning. Cloudflare Workers (and the workerd-based dev
// server) abort outbound subrequests with "Network connection lost." when too
// many run at once — a detail page used to fire 5 in parallel, and a browse
// page 9. Three defences are layered here:
//
//   1. A concurrency gate caps simultaneous outbound fetches per isolate, so
//      the subrequest pool is never saturated in the first place.
//   2. In-flight de-duplication collapses identical concurrent URLs into one
//      network call (rails on the same page often request the same endpoint).
//   3. Retries with backoff, plus a stale-cache fallback so an expired entry
//      is served instead of showing the "Failed to load" screen.
const MAX_RETRIES = 4;          // total attempts (1 initial + 3 retries)
const RETRY_BASE_MS = 200;      // backoff base; grows 200 → 400 → 800ms
const REQUEST_TIMEOUT_MS = 8000; // abort a single hung attempt so a retry can run
const MAX_CONCURRENT = 6;       // outbound TMDB fetches in flight at any moment
const STALE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // serve stale data up to 24h old

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// @ts-ignore temporary diagnostics
globalThis.__TMDB_DEBUG__ = true;

// ── Concurrency gate ─────────────────────────────────────────────────────────
let _active = 0;
const _waiters: Array<() => void> = [];

async function acquireSlot(): Promise<void> {
  if (_active < MAX_CONCURRENT) {
    _active++;
    return;
  }
  await new Promise<void>((resolve) => _waiters.push(resolve));
  _active++;
}

function releaseSlot(): void {
  _active = Math.max(0, _active - 1);
  const next = _waiters.shift();
  if (next) next();
}

// ── In-flight de-duplication ─────────────────────────────────────────────────
const _inflight = new Map<string, Promise<unknown>>();

/** True when an error/response is worth retrying (transient, not a real 4xx). */
function isTransient(err: unknown): boolean {
  if (err instanceof Error) {
    const m = err.message.toLowerCase();
    return (
      m.includes('network connection lost') ||
      m.includes('connection') ||
      m.includes('network') ||
      m.includes('timeout') ||
      m.includes('aborted') ||
      m.includes('abort') ||
      m.includes('fetch failed') ||
      m.includes('socket') ||
      m.includes('reset') ||
      m.includes('internal error') ||
      err.name === 'AbortError' ||
      err.name === 'TypeError'
    );
  }
  return false;
}

/** Cache write with simple size-capped (FIFO) eviction. */
function cacheSet(href: string, data: unknown, ttlSeconds: number): void {
  if (_memCache.size >= MEM_CACHE_MAX) {
    const oldestKey = _memCache.keys().next().value;
    if (oldestKey !== undefined) _memCache.delete(oldestKey);
  }
  _memCache.set(href, { expires: Date.now() + ttlSeconds * 1000, data });
}

/** The actual network work for one URL — retried, timed out, concurrency-gated. */
async function fetchWithRetry<T>(href: string, endpoint: string, ttlSeconds: number): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // Per-attempt timeout so a stalled connection doesn't block the whole render.
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), REQUEST_TIMEOUT_MS);

    await acquireSlot();
    try {
      const res = await fetch(href, {
        headers: { 'Content-Type': 'application/json' },
        signal: ac.signal,
        // Cloudflare edge cache — cache the upstream TMDB JSON for `ttlSeconds`.
        // @ts-ignore — `cf` is a Cloudflare Workers RequestInit extension.
        cf: { cacheTtl: ttlSeconds, cacheEverything: true },
      });

      // 429 / 5xx are transient; 404, 401, … are permanent. Both throw here,
      // the catch block decides whether a retry is worthwhile.
      if (!res.ok) {
        throw new Error(`TMDB API error ${res.status}: ${res.statusText} — ${endpoint}`);
      }

      const data = (await res.json()) as T;
      cacheSet(href, data, ttlSeconds);
      return data;
    } catch (err) {
      lastError = err;
      if (globalThis.__TMDB_DEBUG__) {
        console.error(`[tmdb-debug] attempt ${attempt + 1} failed for ${endpoint}:`,
          err instanceof Error ? `${err.name}: ${err.message}\n${err.stack}` : err);
      }
      const status = err instanceof Error ? err.message.match(/error (\d{3})/)?.[1] : undefined;
      const retryableStatus = status === '429' || (status ? Number(status) >= 500 : false);
      // A 4xx (other than 429) is a real answer — never retry it.
      const permanent = status !== undefined && !retryableStatus;
      const shouldRetry = !permanent && (isTransient(err) || retryableStatus) && attempt < MAX_RETRIES - 1;

      if (!shouldRetry) throw err;

      // Exponential backoff with a little jitter to avoid thundering-herd retries.
      await sleep(RETRY_BASE_MS * 2 ** attempt + Math.random() * 120);
    } finally {
      clearTimeout(timer);
      releaseSlot();
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`TMDB request failed — ${endpoint}`);
}

async function tmdbFetch<T>(
  endpoint: string,
  params: Record<string, string | number | boolean | undefined> = {},
  ttlSeconds = 3600
): Promise<T> {
  const apiKey = getApiKey();
  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('language', 'en-US');

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  const href = url.toString();

  // 1. Fresh in-memory hit (keyed on the full URL incl. params).
  const cached = _memCache.get(href);
  if (cached && cached.expires > Date.now()) {
    return cached.data as T;
  }

  // 2. An identical request is already running — share its promise.
  const pending = _inflight.get(href);
  if (pending) return pending as Promise<T>;

  const task = fetchWithRetry<T>(href, endpoint, ttlSeconds)
    .catch((err) => {
      // 3. Last resort: serve stale-but-recent data rather than failing the page.
      const stale = _memCache.get(href);
      const isNotFound = err instanceof Error && / 404[:,]?/.test(err.message);
      if (stale && !isNotFound && Date.now() - (stale.expires - ttlSeconds * 1000) < STALE_MAX_AGE_MS) {
        return stale.data as T;
      }
      throw err;
    })
    .finally(() => {
      _inflight.delete(href);
    });

  _inflight.set(href, task);
  return task;
}

// ─── Trending ────────────────────────────────────────────────────────────────

/** GET /trending/all/week — mixed trending for hero carousel */
export async function getTrending(
  timeWindow: 'day' | 'week' = 'week'
): Promise<TMDBPaginatedResponse<TMDBTrendingItem>> {
  return tmdbFetch(`/trending/all/${timeWindow}`);
}

/** GET /trending/movie/week */
export async function getTrendingMovies(
  timeWindow: 'day' | 'week' = 'week'
): Promise<TMDBPaginatedResponse<TMDBMovieBase>> {
  return tmdbFetch(`/trending/movie/${timeWindow}`);
}

/** GET /trending/tv/week */
export async function getTrendingSeries(
  timeWindow: 'day' | 'week' = 'week'
): Promise<TMDBPaginatedResponse<TMDBSeriesBase>> {
  return tmdbFetch(`/trending/tv/${timeWindow}`);
}

// ─── Movies ───────────────────────────────────────────────────────────────────

/** GET /movie/{id} — full movie details */
export async function getMovie(id: number | string): Promise<TMDBMovie> {
  return tmdbFetch(`/movie/${id}`);
}

/** GET /movie/{id}/credits */
export async function getMovieCredits(id: number | string): Promise<TMDBCredits> {
  return tmdbFetch(`/movie/${id}/credits`);
}

/** GET /movie/{id}/videos */
export async function getMovieVideos(id: number | string): Promise<TMDBVideosResponse> {
  return tmdbFetch(`/movie/${id}/videos`);
}

/** GET /movie/{id}/watch/providers */
export async function getMovieWatchProviders(
  id: number | string
): Promise<TMDBWatchProvidersResponse> {
  return tmdbFetch(`/movie/${id}/watch/providers`);
}

/** GET /movie/{id}/recommendations */
export async function getMovieRecommendations(
  id: number | string,
  page = 1
): Promise<TMDBPaginatedResponse<TMDBMovieBase>> {
  return tmdbFetch(`/movie/${id}/recommendations`, { page });
}

/** GET /movie/top_rated */
export async function getTopRatedMovies(
  page = 1
): Promise<TMDBPaginatedResponse<TMDBMovieBase>> {
  return tmdbFetch('/movie/top_rated', { page });
}

/** GET /movie/now_playing */
export async function getNowPlayingMovies(
  page = 1
): Promise<TMDBPaginatedResponse<TMDBMovieBase>> {
  return tmdbFetch('/movie/now_playing', { page });
}

/** GET /movie/upcoming */
export async function getUpcomingMovies(
  page = 1
): Promise<TMDBPaginatedResponse<TMDBMovieBase>> {
  return tmdbFetch('/movie/upcoming', { page });
}

/** GET /movie/popular */
export async function getPopularMovies(
  page = 1
): Promise<TMDBPaginatedResponse<TMDBMovieBase>> {
  return tmdbFetch('/movie/popular', { page });
}

// ─── TV / Series ──────────────────────────────────────────────────────────────

/** GET /tv/{id} — full series details */
export async function getSeries(id: number | string): Promise<TMDBSeries> {
  return tmdbFetch(`/tv/${id}`);
}

/** GET /tv/{id}/season/{season_number} */
export async function getSeasonDetails(
  seriesId: number | string,
  seasonNumber: number
): Promise<TMDBSeason> {
  return tmdbFetch(`/tv/${seriesId}/season/${seasonNumber}`);
}

/** GET /tv/{id}/credits */
export async function getSeriesCredits(id: number | string): Promise<TMDBCredits> {
  return tmdbFetch(`/tv/${id}/credits`);
}

/** GET /tv/{id}/videos */
export async function getSeriesVideos(id: number | string): Promise<TMDBVideosResponse> {
  return tmdbFetch(`/tv/${id}/videos`);
}

/** GET /tv/{id}/watch/providers */
export async function getSeriesWatchProviders(
  id: number | string
): Promise<TMDBWatchProvidersResponse> {
  return tmdbFetch(`/tv/${id}/watch/providers`);
}

/** GET /tv/{id}/recommendations */
export async function getSeriesRecommendations(
  id: number | string,
  page = 1
): Promise<TMDBPaginatedResponse<TMDBSeriesBase>> {
  return tmdbFetch(`/tv/${id}/recommendations`, { page });
}

/** GET /tv/top_rated */
export async function getTopRatedSeries(
  page = 1
): Promise<TMDBPaginatedResponse<TMDBSeriesBase>> {
  return tmdbFetch('/tv/top_rated', { page });
}

/** GET /tv/popular */
export async function getPopularSeries(
  page = 1
): Promise<TMDBPaginatedResponse<TMDBSeriesBase>> {
  return tmdbFetch('/tv/popular', { page });
}

/** GET /tv/on_the_air */
export async function getOnAirSeries(
  page = 1
): Promise<TMDBPaginatedResponse<TMDBSeriesBase>> {
  return tmdbFetch('/tv/on_the_air', { page });
}

// ─── Discover ─────────────────────────────────────────────────────────────────

/** GET /discover/movie */
export async function discoverMovies(
  params: DiscoverMovieParams = {}
): Promise<TMDBPaginatedResponse<TMDBMovieBase>> {
  return tmdbFetch('/discover/movie', params as Record<string, string | number | boolean>);
}

/** GET /discover/tv */
export async function discoverSeries(
  params: DiscoverSeriesParams = {}
): Promise<TMDBPaginatedResponse<TMDBSeriesBase>> {
  return tmdbFetch('/discover/tv', params as Record<string, string | number | boolean>);
}

// ─── Search ───────────────────────────────────────────────────────────────────

export interface SearchMultiResult {
  page: number;
  results: TMDBTrendingItem[];
  total_pages: number;
  total_results: number;
}

/** GET /search/multi */
export async function searchMulti(
  query: string,
  page = 1
): Promise<SearchMultiResult> {
  return tmdbFetch('/search/multi', { query, page }, 60);
}

// ─── Typo-tolerant suggestion ranking ─────────────────────────────────────────
//
// TMDB's search returns loosely-related items in raw popularity order, so a
// misspelling like "avengrs" or a partial like "dark kni" can bury the obvious
// match. We re-rank client-facing suggestions by blending:
//   • fuzzy title similarity (Dice coefficient over character bigrams — robust
//     to transposed/missing letters, i.e. typos), and
//   • a normalised popularity signal (so the famous title wins ties).
// This gives Google-style "did you mean" behaviour without any extra network
// calls or third-party service.

/** Character-bigram multiset for a normalised string. */
function bigrams(input: string): Map<string, number> {
  const s = input.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const map = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const bg = s.slice(i, i + 2);
    map.set(bg, (map.get(bg) ?? 0) + 1);
  }
  return map;
}

/** Sørensen–Dice similarity between two strings (0 = none, 1 = identical). */
function diceSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const A = bigrams(a);
  const B = bigrams(b);
  if (A.size === 0 || B.size === 0) return 0;
  let overlap = 0;
  for (const [bg, countA] of A) {
    const countB = B.get(bg);
    if (countB) overlap += Math.min(countA, countB);
  }
  return (2 * overlap) / (A.size + B.size);
}

/** Minimal shape needed to rank any TMDB search result (movie, series, person). */
export interface SearchScorable {
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  popularity?: number;
}

/** Every title variant a result can be matched against (display + original). */
function candidateTitles(item: SearchScorable): string[] {
  return [item.title, item.name, item.original_title, item.original_name].filter(
    (t): t is string => Boolean(t)
  );
}

/**
 * Best fuzzy similarity between the query and any of a result's title variants.
 * Pure similarity with no popularity component — used for "did you mean"
 * thresholds where a popular-but-unrelated title must not qualify.
 */
export function titleSimilarity(query: string, item: SearchScorable): number {
  const q = query.trim().toLowerCase();
  let best = 0;
  for (const t of candidateTitles(item)) {
    best = Math.max(best, diceSimilarity(q, t.toLowerCase()));
  }
  return best;
}

/** Relevance score for a single result against the raw query (higher = better). */
function scoreResult(query: string, item: SearchScorable): number {
  const q = query.trim().toLowerCase();
  const titles = candidateTitles(item).map((t) => t.toLowerCase());
  if (titles.length === 0) return 0;

  // Score against every title variant and keep the best — matching the original
  // language title ("Parasite" vs "Gisaengchung") should count just as much.
  let relevance = 0;
  for (const title of titles) {
    let s = diceSimilarity(q, title);
    // Strong boosts for direct matches so exact/prefix hits always float up.
    if (title === q) s += 1;
    else if (title.startsWith(q)) s += 0.45;
    else if (title.includes(q)) s += 0.2;
    // Any shared whole word (e.g. "batman" in "The Batman") helps partials.
    else if (q.split(' ').some((w) => w.length > 2 && title.includes(w))) s += 0.12;
    relevance = Math.max(relevance, s);
  }

  // Normalised popularity in ~0..1 (log-scaled: TMDB popularity is long-tailed).
  const popularity = Math.min(1, Math.log10((item.popularity ?? 0) + 1) / 3);

  // Relevance dominates; popularity only breaks ties between similar titles.
  return relevance * 0.8 + popularity * 0.2;
}

/**
 * Re-rank an already-fetched TMDB result list by fuzzy relevance to the query.
 *
 * TMDB returns matches in popularity order, which buries the obvious answer
 * (searching "dark" put unrelated popular titles above "Dark"). Ties keep their
 * original TMDB position, so this only ever reorders genuine near-matches.
 *
 * Items scoring below `minScore` are dropped — unless that would empty the
 * list, in which case the original ordering is returned rather than showing
 * the user nothing.
 */
export function rankByRelevance<T extends SearchScorable>(
  query: string,
  items: readonly T[],
  minScore = 0.18
): T[] {
  const q = query.trim();
  if (!q || items.length === 0) return [...items];

  const scored = items
    .map((item, index) => ({ item, index, score: scoreResult(q, item) }))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const relevant = scored.filter((s) => s.score >= minScore);
  return (relevant.length > 0 ? relevant : scored).map((s) => s.item);
}

/**
 * Typo-tolerant, popularity-aware search suggestions for the autocomplete
 * dropdown and search page. Falls back gracefully to an empty list.
 */
export async function searchSuggestions(
  query: string,
  limit = 8
): Promise<TMDBTrendingItem[]> {
  const q = query.trim();
  // Suggest from as little as a single character so the typeahead starts
  // recommending immediately as the user begins typing.
  if (q.length < 1) return [];

  const res = await searchMulti(q).catch(() => null);

  // Drop people without a name; keep movies/series/known people.
  const candidates = (res?.results ?? []).filter(
    (item) => item.media_type !== 'person' || (item as any).name
  );

  // Nothing came back for the exact string (likely a typo) — retry with relaxed
  // variants so the dropdown still offers the title the user meant.
  if (candidates.length === 0) {
    const variants = relaxedQueryVariants(q);
    const fallbacks = await Promise.all(
      variants.map((v) => searchMulti(v).catch(() => null))
    );
    const seen = new Set<number>();
    for (const fb of fallbacks) {
      for (const item of fb?.results ?? []) {
        if (item.media_type === 'person' && !(item as any).name) continue;
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        candidates.push(item);
      }
    }
  }

  if (candidates.length === 0) return [];

  // Keep only reasonably-relevant items so obvious mismatches don't show up,
  // but never return an empty list when TMDB clearly found *something*.
  const scored = candidates
    .map((item) => ({ item, score: scoreResult(q, item) }))
    .sort((a, b) => b.score - a.score);

  const relevant = scored.filter((s) => s.score >= 0.18);
  const chosen = (relevant.length > 0 ? relevant : scored).slice(0, limit);

  return chosen.map((s) => s.item);
}

/** A suggested title to recover from a misspelled / zero-result query. */
export interface DidYouMeanSuggestion {
  id: number;
  title: string;
  mediaType: 'movie' | 'tv';
  posterPath: string | null;
  year: string;
  href: string;
  /** Fuzzy similarity to the original query (0..1) — useful for debugging/tests. */
  score: number;
}

/**
 * Build relaxed variants of a query so TMDB can still find something when the
 * exact string matches nothing. A trailing/extra-letter typo ("avengerss",
 * "interstellarr") is fixed by prefix truncation; a bad word in a multi-word
 * query ("the dark knightt rises" → "dark") is fixed by using the longest word.
 * Capped at 3 variants to keep this to a single extra round of subrequests.
 */
function relaxedQueryVariants(query: string): string[] {
  const q = query.trim();
  const variants: string[] = [];
  const push = (v: string) => {
    const t = v.trim();
    if (t.length >= 3 && t !== q && !variants.includes(t)) variants.push(t);
  };

  if (q.length >= 5) push(q.slice(0, -1));
  if (q.length >= 7) push(q.slice(0, -2));

  const words = q.split(/\s+/).filter((w) => w.length > 3);
  if (words.length > 1) {
    push(words.reduce((a, b) => (b.length > a.length ? b : a)));
  }

  return variants.slice(0, 3);
}

/**
 * "Did you mean …" recovery for queries TMDB can't match directly.
 *
 * Searches relaxed variants of the query, then keeps only titles that are
 * genuinely close to what the user typed (fuzzy similarity, not popularity) so
 * we never suggest a random blockbuster. Returns [] when nothing is close
 * enough — the caller should then show its normal empty state.
 */
export async function getDidYouMeanSuggestions(
  query: string,
  limit = 6,
  minSimilarity = 0.34
): Promise<DidYouMeanSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  const variants = relaxedQueryVariants(q);
  if (variants.length === 0) return [];

  const responses = await Promise.all(
    variants.map((v) => searchMulti(v).catch(() => null))
  );

  const seen = new Set<string>();
  const suggestions: DidYouMeanSuggestion[] = [];

  for (const res of responses) {
    for (const item of res?.results ?? []) {
      if (item.media_type !== 'movie' && item.media_type !== 'tv') continue;

      const movie = item as TMDBMovieBase;
      const series = item as TMDBSeriesBase;
      const isMovieItem = item.media_type === 'movie';
      const title = isMovieItem ? movie.title : series.name;
      if (!title) continue;

      const key = `${item.media_type}:${item.id}`;
      if (seen.has(key)) continue;

      // Similarity is measured against the ORIGINAL query the user typed.
      const score = titleSimilarity(q, item as SearchScorable);
      if (score < minSimilarity) continue;

      seen.add(key);
      suggestions.push({
        id: item.id,
        title,
        mediaType: isMovieItem ? 'movie' : 'tv',
        posterPath: item.poster_path ?? null,
        year: (isMovieItem ? movie.release_date : series.first_air_date)?.slice(0, 4) ?? '',
        href: isMovieItem ? `/movie/${item.id}` : `/series/${item.id}`,
        score,
      });
    }
  }

  return suggestions
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** GET /search/movie */
export async function searchMovies(
  query: string,
  page = 1
): Promise<TMDBPaginatedResponse<TMDBMovieBase>> {
  return tmdbFetch('/search/movie', { query, page }, 60);
}

/** GET /search/tv */
export async function searchSeries(
  query: string,
  page = 1
): Promise<TMDBPaginatedResponse<TMDBSeriesBase>> {
  return tmdbFetch('/search/tv', { query, page }, 60);
}

/** GET /search/person */
export async function searchPeople(
  query: string,
  page = 1
): Promise<TMDBPaginatedResponse<TMDBPersonBase>> {
  return tmdbFetch('/search/person', { query, page }, 60);
}

// ─── Genres ───────────────────────────────────────────────────────────────────

/** GET /genre/movie/list */
export async function getMovieGenres(): Promise<TMDBGenreList> {
  return tmdbFetch('/genre/movie/list', {}, 86400);
}

/** GET /genre/tv/list */
export async function getSeriesGenres(): Promise<TMDBGenreList> {
  return tmdbFetch('/genre/tv/list', {}, 86400);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Get the official trailer YouTube key for a movie or series.
 * Returns null if no official trailer is found.
 */
export function getOfficialTrailerKey(videos: TMDBVideosResponse): string | null {
  const trailers = videos.results.filter(
    (v) => v.site === 'YouTube' && v.type === 'Trailer' && v.official
  );
  if (trailers.length > 0) return trailers[0].key;

  // Fallback: any YouTube trailer
  const anyTrailer = videos.results.find(
    (v) => v.site === 'YouTube' && v.type === 'Trailer'
  );
  return anyTrailer?.key ?? null;
}

/**
 * Get watch providers for a specific country (defaults to IN for Indian market).
 */
export function getWatchProvidersForCountry(
  providers: TMDBWatchProvidersResponse,
  countryCode = 'IN'
) {
  return providers.results[countryCode] ?? null;
}

/**
 * Full detail fetch for a movie — details, credits, videos, watch providers and
 * recommendations in a SINGLE TMDB request via `append_to_response`.
 *
 * This used to issue 4 parallel subrequests (5 with recommendations). On
 * Cloudflare Workers that fan-out is what triggered "Network connection lost."
 * and blanked the whole page, because one failed leg rejected the Promise.all.
 * One request cannot partially fail.
 */
export async function getMovieFull(id: number | string) {
  type Appended = TMDBMovie & {
    credits?: TMDBCredits;
    videos?: TMDBVideosResponse;
    'watch/providers'?: TMDBWatchProvidersResponse;
    recommendations?: TMDBPaginatedResponse<TMDBMovieBase>;
  };

  const emptyCredits: TMDBCredits = { id: Number(id), cast: [], crew: [] };
  const emptyVideos: TMDBVideosResponse = { id: Number(id), results: [] };
  const emptyProviders: TMDBWatchProvidersResponse = { id: Number(id), results: {} };
  const emptyRecs: TMDBPaginatedResponse<TMDBMovieBase> = {
    page: 1, results: [], total_pages: 0, total_results: 0,
  };

  try {
    const data = await tmdbFetch<Appended>(`/movie/${id}`, {
      append_to_response: 'credits,videos,watch/providers,recommendations',
    });

    const { credits, videos, recommendations, 'watch/providers': watchProviders, ...movie } =
      data as Appended;
    return {
      movie: movie as TMDBMovie,
      credits: credits ?? emptyCredits,
      videos: videos ?? emptyVideos,
      watchProviders: watchProviders ?? emptyProviders,
      recommendations: recommendations ?? emptyRecs,
    };
  } catch (err) {
    // A 404 (or any permanent error) must propagate so the page can redirect.
    if (err instanceof Error && /error 4\d\d/.test(err.message)) throw err;

    // Transient failure on the combined call: fall back to the core details
    // only. The extras are optional, so the page still renders.
    const movie = await getMovie(id);
    const [credits, videos, watchProviders, recommendations] = await Promise.all([
      getMovieCredits(id).catch(() => emptyCredits),
      getMovieVideos(id).catch(() => emptyVideos),
      getMovieWatchProviders(id).catch(() => emptyProviders),
      getMovieRecommendations(id).catch(() => emptyRecs),
    ]);
    return { movie, credits, videos, watchProviders, recommendations };
  }
}

/**
 * Full detail fetch for a series — details, credits, videos, watch providers
 * and recommendations in a SINGLE TMDB request via `append_to_response`.
 */
export async function getSeriesFull(id: number | string) {
  type Appended = TMDBSeries & {
    credits?: TMDBCredits;
    videos?: TMDBVideosResponse;
    'watch/providers'?: TMDBWatchProvidersResponse;
    recommendations?: TMDBPaginatedResponse<TMDBSeriesBase>;
  };

  const emptyCredits: TMDBCredits = { id: Number(id), cast: [], crew: [] };
  const emptyVideos: TMDBVideosResponse = { id: Number(id), results: [] };
  const emptyProviders: TMDBWatchProvidersResponse = { id: Number(id), results: {} };
  const emptyRecs: TMDBPaginatedResponse<TMDBSeriesBase> = {
    page: 1, results: [], total_pages: 0, total_results: 0,
  };

  try {
    const data = await tmdbFetch<Appended>(`/tv/${id}`, {
      append_to_response: 'credits,videos,watch/providers,recommendations',
    });

    const { credits, videos, recommendations, 'watch/providers': watchProviders, ...series } =
      data as Appended;
    return {
      series: series as TMDBSeries,
      credits: credits ?? emptyCredits,
      videos: videos ?? emptyVideos,
      watchProviders: watchProviders ?? emptyProviders,
      recommendations: recommendations ?? emptyRecs,
    };
  } catch (err) {
    if (err instanceof Error && /error 4\d\d/.test(err.message)) throw err;

    const series = await getSeries(id);
    const [credits, videos, watchProviders, recommendations] = await Promise.all([
      getSeriesCredits(id).catch(() => emptyCredits),
      getSeriesVideos(id).catch(() => emptyVideos),
      getSeriesWatchProviders(id).catch(() => emptyProviders),
      getSeriesRecommendations(id).catch(() => emptyRecs),
    ]);
    return { series, credits, videos, watchProviders, recommendations };
  }
}

/**
 * Home page data — all rails in a single multi-fetch.
 */
export async function getHomeData() {
  const [trending, trendingMovies, trendingSeries, topRated, nowPlaying] = await Promise.all([
    getTrending('week'),
    getTrendingMovies('week'),
    getTrendingSeries('week'),
    getTopRatedMovies(),
    getNowPlayingMovies(),
  ]);
  return { trending, trendingMovies, trendingSeries, topRated, nowPlaying };
}

// ─── Discover by genre / network / company ────────────────────────────────────

/** GET /discover/movie filtered by a single genre id. */
export async function getMoviesByGenre(genreId: number, page = 1) {
  return tmdbFetch<TMDBPaginatedResponse<TMDBMovieBase>>('/discover/movie', {
    with_genres: genreId,
    sort_by: 'popularity.desc',
    'vote_count.gte': 100,
    page,
  });
}

/** GET /discover/tv filtered by a single genre id (optionally by language, e.g. anime). */
export async function getSeriesByGenre(
  genreId: number,
  page = 1,
  originalLanguage?: string
) {
  return tmdbFetch<TMDBPaginatedResponse<TMDBSeriesBase>>('/discover/tv', {
    with_genres: genreId,
    sort_by: 'popularity.desc',
    'vote_count.gte': 50,
    with_original_language: originalLanguage,
    page,
  });
}

/** GET /discover/tv by TV network (e.g. Netflix=213, Disney+=2739). */
export async function getSeriesByNetwork(networkId: number, page = 1) {
  return tmdbFetch<TMDBPaginatedResponse<TMDBSeriesBase>>('/discover/tv', {
    with_networks: networkId,
    sort_by: 'popularity.desc',
    page,
  });
}

/** GET /discover/movie by production company (e.g. Marvel Studios=420, Disney=2). */
export async function getMoviesByCompany(companyId: number, page = 1) {
  return tmdbFetch<TMDBPaginatedResponse<TMDBMovieBase>>('/discover/movie', {
    with_companies: companyId,
    sort_by: 'popularity.desc',
    page,
  });
}

// ─── Hero slides (enriched with runtime + genre names) ────────────────────────

export interface HeroSlide {
  id: number;
  mediaType: 'movie' | 'tv';
  title: string;
  overview: string;
  backdropUrl: string | null;
  posterUrl: string | null;
  releaseYear: string;
  rating: number;
  genres: string[];
  /** Human runtime, e.g. "2h 14m" or "45m" — null when unknown. */
  runtime: string | null;
  href: string;
}

const MOVIE_GENRE_NAMES: Record<number, string> = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
  99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
  27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance',
  878: 'Science Fiction', 10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
};

const TV_GENRE_NAMES: Record<number, string> = {
  10759: 'Action & Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
  99: 'Documentary', 18: 'Drama', 10751: 'Family', 10762: 'Kids', 9648: 'Mystery',
  10763: 'News', 10764: 'Reality', 10765: 'Sci-Fi & Fantasy', 10766: 'Soap',
  10767: 'Talk', 10768: 'War & Politics', 37: 'Western',
};

/**
 * Build hero slides from data already present in TMDB list responses. The old
 * implementation fetched full details for every slide, adding 5–10 requests
 * and a complete second network waterfall to every catalog render.
 */
export async function buildHeroSlides(
  items: Array<TMDBMovieBase | TMDBSeriesBase>,
  mediaType: 'movie' | 'tv',
  limit = 5
): Promise<HeroSlide[]> {
  const BACKDROP = `${TMDB_IMAGE_BASE}/w1280`;
  const POSTER = `${TMDB_IMAGE_BASE}/w500`;
  const genreNames = mediaType === 'movie' ? MOVIE_GENRE_NAMES : TV_GENRE_NAMES;

  return items
    .filter((item) => item.backdrop_path)
    .slice(0, limit)
    .map((item) => {
      const isMovie = mediaType === 'movie';
      const movie = item as TMDBMovieBase;
      const series = item as TMDBSeriesBase;
      return {
        id: item.id,
        mediaType,
        title: isMovie ? movie.title : series.name,
        overview: item.overview,
        backdropUrl: item.backdrop_path ? `${BACKDROP}${item.backdrop_path}` : null,
        posterUrl: item.poster_path ? `${POSTER}${item.poster_path}` : null,
        releaseYear: (isMovie ? movie.release_date : series.first_air_date)?.slice(0, 4) ?? '',
        rating: Math.round(item.vote_average * 10) / 10,
        genres: (item.genre_ids ?? []).map((id) => genreNames[id]).filter(Boolean).slice(0, 3),
        runtime: null,
        href: isMovie ? `/movie/${item.id}` : `/series/${item.id}`,
      } satisfies HeroSlide;
    });
}

/**
 * Home-page payload. Only fetch data that is actually rendered; the previous
 * version requested nine genre/company rails that were discarded by the page.
 */
export async function getHomePageData() {
  const empty = { results: [] as never[], page: 1, total_pages: 0, total_results: 0 };
  const safe = <T>(p: Promise<T>, fallback: T): Promise<T> => p.catch(() => fallback);

  const [
    trending,
    trendingMovies,
    trendingSeries,
    topRatedMovies,
    nowPlaying,
    onAir,
    upcoming,
    popularMovies,
  ] = await Promise.all([
    safe(getTrending('week'), empty as any),
    safe(getTrendingMovies('week'), empty as any),
    safe(getTrendingSeries('week'), empty as any),
    safe(getTopRatedMovies(), empty as any),
    safe(getNowPlayingMovies(), empty as any),
    safe(getOnAirSeries(), empty as any),
    safe(getUpcomingMovies(), empty as any),
    safe(getPopularMovies(), empty as any),
  ]);

  // Enrich hero carousels (top 5 each) — parallelised inside the builders.
  const [heroMovies, heroSeries] = await Promise.all([
    buildHeroSlides(trendingMovies.results, 'movie', 5).catch(() => []),
    buildHeroSlides(trendingSeries.results, 'tv', 5).catch(() => []),
  ]);

  // Merge into one alternating carousel: movie, series, movie, series… (up to 10 slides).
  const heroAll: HeroSlide[] = [];
  const maxLen = Math.max(heroMovies.length, heroSeries.length);
  for (let i = 0; i < maxLen && heroAll.length < 10; i++) {
    if (i < heroMovies.length) heroAll.push(heroMovies[i]);
    if (i < heroSeries.length && heroAll.length < 10) heroAll.push(heroSeries[i]);
  }

  return {
    heroAll,
    trending,
    trendingMovies,
    trendingSeries,
    topRatedMovies,
    nowPlaying,
    onAir,
    upcoming,
    popularMovies,
  };
}

/**
 * Anime page payload — all TMDB fetches for /anime in one place.
 * Filters: with_original_language=ja, with_genres includes 16 (Animation).
 */
export async function getAnimePageData(opts: {
  page?: number;
  sortBy?: string;
  genres?: string;
  yearFrom?: string;
  yearTo?: string;
  minRating?: string;
} = {}) {
  const { page = 1, sortBy = 'popularity.desc', genres, yearFrom, yearTo, minRating } = opts;
  const empty = { results: [] as TMDBSeriesBase[], page: 1, total_pages: 0, total_results: 0 };
  const s = <T>(p: Promise<T>, fb: T): Promise<T> => p.catch(() => fb);

  const ANIM = 16;
  const gridParams: DiscoverSeriesParams = {
    page,
    sort_by: sortBy,
    with_genres: genres || String(ANIM),
    with_original_language: 'ja',
    'first_air_date.gte': yearFrom ? `${yearFrom}-01-01` : undefined,
    'first_air_date.lte': yearTo   ? `${yearTo}-12-31`   : undefined,
    'vote_average.gte':  minRating  ? parseFloat(minRating) : undefined,
  };

  const [gridRes, genresRes, trendingRes, topAiringRes, popularRes, romanceRes, actionRes, scifiRes, upcomingRes] = await Promise.all([
    discoverSeries(gridParams),
    s(getSeriesGenres(), { genres: [] }),
    s(getTrendingSeries('week'), empty),
    s(getSeriesByGenre(ANIM, 1, 'ja'), empty),
    s(discoverSeries({ with_genres: String(ANIM), with_original_language: 'ja', sort_by: 'vote_count.desc', page: 1 }), empty),
    s(discoverSeries({ with_genres: `${ANIM},10749`, with_original_language: 'ja', sort_by: 'popularity.desc', page: 1 }), empty),
    s(discoverSeries({ with_genres: `${ANIM},28`,   with_original_language: 'ja', sort_by: 'popularity.desc', page: 1 }), empty),
    s(discoverSeries({ with_genres: `${ANIM},10765`, with_original_language: 'ja', sort_by: 'popularity.desc', page: 1 }), empty),
    s(discoverSeries({ with_genres: String(ANIM), with_original_language: 'ja', sort_by: 'first_air_date.desc', page: 1 }), empty),
  ]);

  const trendingAnime = (trendingRes.results as TMDBSeriesBase[])
    .filter((s) => (s as any).original_language === 'ja')
    .slice(0, 5);

  const heroSource = trendingAnime.length >= 3 ? trendingAnime : topAiringRes.results.slice(0, 5);
  const heroSlides = await buildHeroSlides(heroSource, 'tv', 5).catch(() => [] as HeroSlide[]);

  return {
    heroSlides,
    grid:       gridRes,
    genres:     genresRes.genres,
    topAiring:  topAiringRes.results.slice(0, 20),
    popular:    popularRes.results.slice(0, 20),
    romance:    romanceRes.results.slice(0, 20),
    action:     actionRes.results.slice(0, 20),
    scifi:      scifiRes.results.slice(0, 20),
    upcoming:   upcomingRes.results.slice(0, 20),
  };
}

// ─── Streaming platform IDs ───────────────────────────────────────────────────
// TMDB watch-provider IDs (IN region)
// Netflix=8, Amazon Prime Video=119, Disney+=122, Hotstar=122 (Star/Hotstar=392)
const PROVIDER = {
  netflix:  8,
  prime:    119,
  disney:   122,
  hotstar:  392, // Star / Disney+ Hotstar (India)
  appletv:  350, // Apple TV+
} as const;

/** Top 10 trending series on a given watch-provider (by popularity). */
export async function getTop10ByProvider(
  providerId: number,
  mediaType: 'movie' | 'tv' = 'tv',
  region = 'IN'
) {
  const empty = { results: [] as (TMDBMovieBase | TMDBSeriesBase)[] };
  try {
    if (mediaType === 'tv') {
      const res = await tmdbFetch<TMDBPaginatedResponse<TMDBSeriesBase>>('/discover/tv', {
        with_watch_providers: providerId,
        watch_region: region,
        sort_by: 'popularity.desc',
        'vote_count.gte': 20,
        page: 1,
      });
      return { results: res.results.slice(0, 10) };
    }
    const res = await tmdbFetch<TMDBPaginatedResponse<TMDBMovieBase>>('/discover/movie', {
      with_watch_providers: providerId,
      watch_region: region,
      sort_by: 'popularity.desc',
      'vote_count.gte': 20,
      page: 1,
    });
    return { results: res.results.slice(0, 10) };
  } catch { return empty; }
}

/**
 * Full platform page data — hero slides + multiple content rails.
 */
export async function getPlatformPageData(platform: 'netflix' | 'prime' | 'disney' | 'hotstar' | 'appletv') {
  const pid = PROVIDER[platform];
  const empty = { results: [] as any[], page: 1, total_pages: 0, total_results: 0 };
  const s = <T>(p: Promise<T>, fb: T): Promise<T> => p.catch(() => fb);

  const [top10TV, top10Movies, popularTV, popularMovies, trendingTV] = await Promise.all([
    s(getTop10ByProvider(pid, 'tv'),    { results: [] }),
    s(getTop10ByProvider(pid, 'movie'), { results: [] }),
    s(tmdbFetch<TMDBPaginatedResponse<TMDBSeriesBase>>('/discover/tv', {
        with_watch_providers: pid, watch_region: 'IN',
        sort_by: 'vote_average.desc', 'vote_count.gte': 100, page: 1,
      }), empty),
    s(tmdbFetch<TMDBPaginatedResponse<TMDBMovieBase>>('/discover/movie', {
        with_watch_providers: pid, watch_region: 'IN',
        sort_by: 'vote_average.desc', 'vote_count.gte': 100, page: 1,
      }), empty),
    s(getTrendingSeries('week'), empty),
  ]);

  // Build hero from top10 TV items that have a backdrop
  const heroSource = (top10TV.results as TMDBSeriesBase[]).filter(i => i.backdrop_path).slice(0, 5);
  const heroSlides = await buildHeroSlides(heroSource, 'tv', 5).catch(() => [] as HeroSlide[]);

  return {
    heroSlides,
    top10TV:       (top10TV.results    as TMDBSeriesBase[]).slice(0, 10),
    top10Movies:   (top10Movies.results as TMDBMovieBase[]).slice(0, 10),
    popularTV:     (popularTV.results   as TMDBSeriesBase[]).slice(0, 20),
    popularMovies: (popularMovies.results as TMDBMovieBase[]).slice(0, 20),
  };
}

/** Quick home-page top-10 fetch for all 4 platforms in parallel. */
export async function getAllPlatformTop10() {
  const s = <T>(p: Promise<T>, fb: T): Promise<T> => p.catch(() => fb);
  const empty = { results: [] as any[] };
  const [netflixTV, primeTV, hotstarTV, appletvTV] = await Promise.all([
    s(getTop10ByProvider(PROVIDER.netflix, 'tv'),  empty),
    s(getTop10ByProvider(PROVIDER.prime,   'tv'),  empty),
    s(getTop10ByProvider(PROVIDER.hotstar, 'tv'),  empty),
    s(getTop10ByProvider(PROVIDER.appletv, 'tv'),  empty),
  ]);
  return {
    netflixTop10: netflixTV.results  as TMDBSeriesBase[],
    primeTop10:   primeTV.results    as TMDBSeriesBase[],
    hotstarTop10: hotstarTV.results  as TMDBSeriesBase[],
    appletvTop10: appletvTV.results  as TMDBSeriesBase[],
  };
}
