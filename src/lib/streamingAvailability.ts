// src/lib/streamingAvailability.ts — "where can I legally watch this, and in
// which audio language?" via streaming-availability.p.rapidapi.com.
//
// WHY THIS EXISTS
// The embed providers in src/lib/embed.ts render inside a cross-origin iframe,
// so the page cannot enumerate — let alone switch — their audio tracks. There is
// no postMessage API for it on any of them. The only honest way to answer "is
// this available in Hindi?" is to ask a metadata service that tracks per-service
// audio tracks, which is exactly what this API returns:
//
//   streamingOptions.<country>[].audios[].language    ISO 639-2/T, e.g. 'hin'
//   streamingOptions.<country>[].subtitles[].locale.language
//
// So this module powers a *legal deep-link* surface ("Watch in हिन्दी on
// JioHotstar"), not an in-player track selector. That distinction is the whole
// point — see docs and the comment block in src/lib/embed.ts.
//
// SECURITY: RAPIDAPI_KEY is a server-only secret read from astro:env/server.
// Never import this module into a client island; the browser talks to
// /api/availability instead, which returns only the normalised, key-free shape.
//
// DEGRADATION: the key is optional in the env schema. With no key (or on any
// upstream failure) every function resolves to `null`/`[]` rather than throwing,
// because "we could not look up where to watch" must never take down a detail
// page whose primary content came from TMDB.

import { RAPIDAPI_KEY } from 'astro:env/server';
import { nativeLanguageName } from './player/languages';

const API_HOST = 'streaming-availability.p.rapidapi.com';
const API_BASE = `https://${API_HOST}`;

/** Upstream is a third party on a shared plan; do not let it stall a page. */
const TIMEOUT_MS = 5000;

/**
 * Availability changes on the order of days (a title leaves Netflix, arrives on
 * Prime), so a long TTL is safe and keeps us inside the RapidAPI quota — the
 * free tier is metered per request, and a detail page is the most-hit route on
 * the site.
 */
const TTL_MS = 6 * 60 * 60 * 1000;
/** Misses are cached too (briefly) so a cold/unknown title cannot hammer quota. */
const TTL_MISS_MS = 15 * 60 * 1000;
const CACHE_MAX = 500;

/** Default catalogue country. Overridable per call. */
export const DEFAULT_COUNTRY = 'in';

// ─── ISO 639-2 → 639-1 ────────────────────────────────────────────────────────
// The API reports audio/subtitle languages as three-letter ISO 639-2 codes,
// while player/languages.ts (and Intl.DisplayNames' most reliable path) keys off
// two-letter 639-1. Without this bridge every badge would read 'HIN' instead of
// 'हिन्दी'. Both the /T (terminological) and /B (bibliographic) spellings appear
// in the wild — 'deu' vs 'ger', 'fra' vs 'fre' — so both are mapped.
const ISO_639_2_TO_1: Record<string, string> = {
  ara: 'ar', ben: 'bn', bul: 'bg', cat: 'ca', ces: 'cs', cze: 'cs',
  cmn: 'zh', dan: 'da', deu: 'de', ger: 'de', ell: 'el', gre: 'el',
  eng: 'en', spa: 'es', est: 'et', eus: 'eu', baq: 'eu', fas: 'fa',
  per: 'fa', fin: 'fi', fil: 'fil', fra: 'fr', fre: 'fr', guj: 'gu',
  heb: 'he', hin: 'hi', hrv: 'hr', hun: 'hu', hye: 'hy', arm: 'hy',
  ind: 'id', isl: 'is', ice: 'is', ita: 'it', jpn: 'ja', kan: 'kn',
  kaz: 'kk', khm: 'km', kor: 'ko', lav: 'lv', lit: 'lt', mal: 'ml',
  mar: 'mr', mkd: 'mk', mac: 'mk', msa: 'ms', may: 'ms', mya: 'my',
  bur: 'my', nep: 'ne', nld: 'nl', dut: 'nl', nob: 'nb', nor: 'no',
  pan: 'pa', pol: 'pl', por: 'pt', ron: 'ro', rum: 'ro', rus: 'ru',
  sin: 'si', slk: 'sk', slo: 'sk', slv: 'sl', som: 'so', sqi: 'sq',
  alb: 'sq', srp: 'sr', swe: 'sv', swa: 'sw', tam: 'ta', tel: 'te',
  tha: 'th', tur: 'tr', ukr: 'uk', urd: 'ur', vie: 'vi', zho: 'zh',
  chi: 'zh', yue: 'yue',
};

/** Normalise any code the API hands us to a BCP-47-ish tag we can name. */
function toBcp47(code: string | null | undefined): string {
  const raw = (code ?? '').trim().toLowerCase();
  if (!raw) return '';
  // Already a region-qualified tag ('pt-BR') or 639-1 ('en').
  const [base = '', ...rest] = raw.replace(/_/g, '-').split('-');
  const mapped = base.length === 3 ? (ISO_639_2_TO_1[base] ?? base) : base;
  return rest.length > 0 ? [mapped, ...rest].join('-') : mapped;
}

// ─── Public shape (client-safe) ───────────────────────────────────────────────

/** How a service offers a title. Mirrors the upstream `type` field. */
export type OfferType = 'subscription' | 'free' | 'rent' | 'buy' | 'addon';

/** A language, ready to render. */
export interface AudioLanguage {
  /** Normalised tag, e.g. 'hi'. */
  code: string;
  /** Endonym for display, e.g. 'हिन्दी'. */
  label: string;
}

/** One legal way to watch, on one service, in one country. */
export interface WatchOption {
  serviceId: string;
  serviceName: string;
  /** Service brand colour from upstream (hex incl. '#'), or null. */
  themeColor: string | null;
  type: OfferType;
  /** Deep link to the title on the service. */
  link: string;
  /** Selectable audio (dub) languages. */
  audios: AudioLanguage[];
  /** Available subtitle languages. */
  subtitles: AudioLanguage[];
  /** Formatted price for rent/buy, e.g. '₹149.00'. Null for subscription/free. */
  price: string | null;
  /** 'sd' | 'hd' | 'qhd' | 'uhd' as reported upstream, or null. */
  quality: string | null;
}

export interface Availability {
  country: string;
  /** Upstream's own title, handy for sanity-checking an id mapping. */
  title: string;
  options: WatchOption[];
  /** Union of every audio language across all options, de-duplicated. */
  audioLanguages: AudioLanguage[];
}

/** What we want to look up. TMDB ids — the API accepts them natively. */
export type AvailabilityTarget =
  | { kind: 'movie'; id: number | string }
  | { kind: 'tv'; id: number | string };

// ─── Upstream response (only the fields we read) ───────────────────────────────

interface RawLocale {
  language?: string;
}
interface RawOption {
  service?: { id?: string; name?: string; themeColorCode?: string };
  type?: string;
  link?: string;
  audios?: Array<{ language?: string }>;
  subtitles?: Array<{ locale?: RawLocale }>;
  price?: { formatted?: string };
  quality?: string;
}
interface RawShow {
  title?: string;
  streamingOptions?: Record<string, RawOption[]>;
  message?: string;
}

// ─── Cache ────────────────────────────────────────────────────────────────────

const _cache = new Map<string, { expires: number; value: Availability | null }>();

function cacheKey(target: AvailabilityTarget, country: string): string {
  return `${target.kind}:${target.id}:${country}`;
}

function cacheSet(key: string, value: Availability | null): void {
  if (_cache.size >= CACHE_MAX) {
    const oldest = _cache.keys().next().value;
    if (oldest !== undefined) _cache.delete(oldest);
  }
  _cache.set(key, { expires: Date.now() + (value ? TTL_MS : TTL_MISS_MS), value });
}

// ─── Fetch + normalise ────────────────────────────────────────────────────────

const VALID_OFFER_TYPES = new Set<OfferType>(['subscription', 'free', 'rent', 'buy', 'addon']);

function toLanguages(codes: Array<string | undefined>): AudioLanguage[] {
  const seen = new Map<string, AudioLanguage>();
  for (const raw of codes) {
    const code = toBcp47(raw);
    if (!code) continue; // drops 'und'/'mul'/'zxx' and blanks
    if (!seen.has(code)) seen.set(code, { code, label: nativeLanguageName(code) });
  }
  // Stable, human order so the badge row does not reshuffle between requests.
  return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Path segment for a target.
 *
 * The API resolves TMDB ids in `type/id` form directly (`movie/278`,
 * `tv/94997`), which is why this module needs no IMDb id and therefore no extra
 * TMDB `external_ids` round-trip. Note the upstream *show type* for a series is
 * 'series', but the *id prefix* is still 'tv'.
 */
function pathFor(target: AvailabilityTarget): string {
  return `${target.kind}/${target.id}`;
}

/** True when a RapidAPI key is configured, so callers can skip the UI entirely. */
export function isAvailabilityConfigured(): boolean {
  return Boolean(RAPIDAPI_KEY);
}

/**
 * Look up legal streaming options for one title in one country.
 *
 * Resolves to `null` when unconfigured, unknown upstream, or on any failure —
 * never throws. `options` may legitimately be an empty array when the title
 * exists but nobody streams it in that country.
 */
export async function getAvailability(
  target: AvailabilityTarget,
  country: string = DEFAULT_COUNTRY
): Promise<Availability | null> {
  const key = RAPIDAPI_KEY;
  if (!key) return null;

  const cc = country.trim().toLowerCase() || DEFAULT_COUNTRY;
  const ck = cacheKey(target, cc);
  const hit = _cache.get(ck);
  if (hit && hit.expires > Date.now()) return hit.value;

  const url = `${API_BASE}/shows/${pathFor(target)}?country=${encodeURIComponent(cc)}`;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);

  let result: Availability | null = null;
  try {
    const res = await fetch(url, {
      signal: ac.signal,
      headers: { 'x-rapidapi-host': API_HOST, 'x-rapidapi-key': key },
    });
    // 404 = upstream does not know this id; 429 = quota. Both are cached as a
    // miss so we stop asking for a while.
    if (res.ok) {
      const data = (await res.json()) as RawShow;
      if (!data.message) result = normalise(data, cc);
    }
  } catch {
    result = null; // timeout / network / abort
  } finally {
    clearTimeout(timer);
  }

  cacheSet(ck, result);
  return result;
}

function normalise(data: RawShow, country: string): Availability {
  const raw = data.streamingOptions?.[country] ?? [];

  const options: WatchOption[] = raw
    .filter((o) => o.link && o.service?.id)
    .map((o) => ({
      serviceId: o.service!.id!,
      serviceName: o.service?.name ?? o.service!.id!,
      themeColor: o.service?.themeColorCode ?? null,
      type: VALID_OFFER_TYPES.has(o.type as OfferType) ? (o.type as OfferType) : 'subscription',
      link: o.link!,
      audios: toLanguages((o.audios ?? []).map((a) => a.language)),
      subtitles: toLanguages((o.subtitles ?? []).map((s) => s.locale?.language)),
      price: o.price?.formatted ?? null,
      quality: o.quality ?? null,
    }))
    // Cheapest-intent first: things you may already pay for, then free, then
    // transactional. Within a tier, more audio options is the better offer.
    .sort((a, b) => {
      const rank: Record<OfferType, number> = {
        subscription: 0, free: 1, addon: 2, rent: 3, buy: 4,
      };
      return rank[a.type] - rank[b.type] || b.audios.length - a.audios.length;
    });

  // De-duplicate one more time across services for the summary badge row.
  const audioLanguages = toLanguages(
    options.flatMap((o) => o.audios.map((a) => a.code))
  );

  return {
    country,
    title: data.title ?? '',
    options,
    audioLanguages,
  };
}
