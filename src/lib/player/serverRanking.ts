// src/lib/player/serverRanking.ts — how the player decides WHICH server to play.
//
// Client-safe by construction: no `astro:env`, no provider URLs, no secrets, so
// this module is imported by both the React islands and by src/lib/embed.ts on
// the server. It is the single source of truth for
//   • the declared per-server quality registry (SERVER_QUALITY),
//   • the ranking comparator (rankServers),
//   • the per-server reliability ledger recorded from real playback outcomes,
//   • the per-title manual override that survives re-renders and remounts.
//
// WHY A COMPARATOR AND NOT "servers[0]"
// The backend hands back a list sorted by probe result. Taking the head of that
// list is not a decision, it is an accident of registry order: two servers that
// both answered the probe tie, and the tie is broken by whichever was declared
// first in EMBED_SERVER_META. This module makes the choice explicit and ordered
// by evidence, so "auto" means "the best one we can justify", not "the first".
//
// HONESTY ABOUT QUALITY DATA — READ BEFORE POPULATING SERVER_QUALITY
// Resolution and bitrate are NOT introspectable for these providers: each one
// renders its own player in JavaScript inside a cross-origin iframe, so the
// parent page can never read the rendition it selected. There is therefore no
// measurement we can take that would fill these fields in, and inventing values
// would make the ranking lie in a way nobody could debug. Every entry below is
// deliberately null until real, sourced numbers exist (see the comment on
// SERVER_QUALITY for exactly what is needed). Until then `rankServers` falls
// through to the signals that ARE real and measured:
//   evidence (live > title-verified > online) → reliability → probe latency.

/** Declared capability of one streaming server. */
export interface ServerQuality {
  /**
   * Best vertical resolution the provider is known to serve, e.g. 1080.
   * null = unknown. NOT guessed from the provider's marketing copy.
   */
  maxHeight: number | null;
  /** Best sustained video bitrate in kbps, when documented. null = unknown. */
  bitrateKbps: number | null;
  /** Human label for the badge ("1080p"). Derived from maxHeight when absent. */
  label?: string | null;
}

/**
 * Per-server quality registry, keyed by the same ids as EMBED_SERVER_META.
 *
 * TO POPULATE THIS, one of the following has to be added to the data model —
 * this file cannot derive any of it:
 *   1. A curated per-provider capability record (maxHeight + bitrateKbps),
 *      sourced from the provider's own documentation or from an offline
 *      measurement run, stored here or in a CMS/KV table keyed by server id; or
 *   2. A per-title manifest inspection service running server-side (fetch the
 *      provider's HLS master playlist out-of-band and read the RESOLUTION and
 *      BANDWIDTH attributes of each EXT-X-STREAM-INF), exposed through
 *      /api/embed/servers as `maxHeight` / `bitrateKbps` per server per title.
 * Option 2 is the accurate one, because these providers serve different
 * renditions for different titles; option 1 is a usable approximation.
 */
export const SERVER_QUALITY: Readonly<Record<string, ServerQuality>> = {
  nexstream: { maxHeight: null, bitrateKbps: null },
  vidlink: { maxHeight: null, bitrateKbps: null },
  videasy: { maxHeight: null, bitrateKbps: null },
  vidfast: { maxHeight: null, bitrateKbps: null },
};

/** Quality for a server id, always defined so callers need no null checks. */
export function qualityFor(id: string): ServerQuality {
  return SERVER_QUALITY[id] ?? { maxHeight: null, bitrateKbps: null };
}

/** Badge text for a server, or null when we genuinely do not know. */
export function qualityLabel(id: string): string | null {
  const q = qualityFor(id);
  if (q.label) return q.label;
  if (q.maxHeight) return `${q.maxHeight}p`;
  return null;
}

/** The shape `rankServers` needs. Any superset works (AvailableServer does). */
export interface RankableServer {
  id: string;
  /** Provider recognised this exact title (probe reached 'title' confidence). */
  verified: boolean;
  /** Provider answered the probe for this title. */
  online: boolean;
  /** The frame proved it is streaming in THIS browser — the strongest signal. */
  live?: boolean;
  /** Probe round-trip in ms, measured server-side. null when not measured. */
  latencyMs?: number | null;
  /** Declared best resolution, when the data model carries it. */
  maxHeight?: number | null;
  /** Declared best bitrate, when the data model carries it. */
  bitrateKbps?: number | null;
}

/** Why a server ended up where it did — surfaced in the UI title attribute. */
export interface RankedServer<T extends RankableServer = RankableServer> {
  server: T;
  /** 0-based position in the ranked list; 0 is the auto-selected pick. */
  rank: number;
  /** Machine-readable reason for the position. */
  reason: 'quality' | 'confirmed' | 'reliable' | 'fast' | 'unproven' | 'failing';
}

// ─── Reliability ledger ───────────────────────────────────────────────────────
// Real, first-party signal: every time a server actually plays (the frame
// reports life) or actually fails (the frame errors or never loads), we record
// it. Unlike a datacenter probe this is measured from the viewer's own network,
// which is the only place that matters.

const HEALTH_KEY = 'filmora.player.serverHealth.v1';
/** Entries older than this are dropped — a provider that broke last month is
 *  not evidence about today. */
const HEALTH_TTL_MS = 14 * 24 * 60 * 60 * 1000;
/** Cap the recorded history so one bad night cannot permanently bury a server. */
const HEALTH_MAX = 20;

export interface ServerHealth {
  successes: number;
  failures: number;
  /** Epoch ms of the most recent failure, for recency weighting. */
  lastFailureAt: number | null;
  /** Epoch ms of the most recent write, for TTL pruning. */
  updatedAt: number;
}

export type HealthLedger = Record<string, ServerHealth>;

function canUseStorage(store: 'local' | 'session'): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return !!(store === 'local' ? window.localStorage : window.sessionStorage);
  } catch {
    return false; // blocked by a strict privacy setting
  }
}

/** Read the ledger, pruning stale entries. Never throws. */
export function readHealth(): HealthLedger {
  if (!canUseStorage('local')) return {};
  try {
    const raw = localStorage.getItem(HEALTH_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as HealthLedger;
    if (!parsed || typeof parsed !== 'object') return {};
    const now = Date.now();
    const out: HealthLedger = {};
    for (const [id, entry] of Object.entries(parsed)) {
      if (!entry || typeof entry !== 'object') continue;
      if (now - (entry.updatedAt ?? 0) > HEALTH_TTL_MS) continue;
      out[id] = {
        successes: Math.max(0, Math.min(HEALTH_MAX, Number(entry.successes) || 0)),
        failures: Math.max(0, Math.min(HEALTH_MAX, Number(entry.failures) || 0)),
        lastFailureAt: Number(entry.lastFailureAt) || null,
        updatedAt: Number(entry.updatedAt) || now,
      };
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Record a real playback outcome for a server.
 *
 * Returns the updated ledger so callers can re-rank immediately without a
 * second read (and so this stays testable without touching storage).
 */
export function recordServerOutcome(id: string, ok: boolean): HealthLedger {
  const ledger = readHealth();
  const now = Date.now();
  const current = ledger[id] ?? { successes: 0, failures: 0, lastFailureAt: null, updatedAt: now };
  const next: ServerHealth = {
    successes: Math.min(HEALTH_MAX, current.successes + (ok ? 1 : 0)),
    failures: Math.min(HEALTH_MAX, current.failures + (ok ? 0 : 1)),
    lastFailureAt: ok ? current.lastFailureAt : now,
    updatedAt: now,
  };
  ledger[id] = next;
  if (canUseStorage('local')) {
    try {
      localStorage.setItem(HEALTH_KEY, JSON.stringify(ledger));
    } catch {
      /* quota / private mode — ranking simply loses its memory */
    }
  }
  return ledger;
}

/** 0 (never failed) … 1 (always failed). Unknown servers score 0. */
export function failureRate(health: ServerHealth | undefined): number {
  if (!health) return 0;
  const total = health.successes + health.failures;
  if (total === 0) return 0;
  return health.failures / total;
}

// ─── Ranking ──────────────────────────────────────────────────────────────────

/** live > provider recognised the title > provider answered > nothing. */
function evidenceRank(server: RankableServer): number {
  if (server.live) return 3;
  if (server.verified) return 2;
  if (server.online) return 1;
  return 0;
}

function qualityRank(server: RankableServer): number {
  const declared = qualityFor(server.id);
  return server.maxHeight ?? declared.maxHeight ?? -1;
}

function bitrateRank(server: RankableServer): number {
  const declared = qualityFor(server.id);
  return server.bitrateKbps ?? declared.bitrateKbps ?? -1;
}

export interface RankOptions {
  /** Reliability ledger; pass `readHealth()` once and reuse. */
  health?: HealthLedger;
  /**
   * Servers already tried and failed for the CURRENT title. Always ranked last
   * regardless of how good they look on paper — a server that just failed for
   * this exact episode is not a candidate, whatever its resolution.
   */
  tried?: ReadonlySet<string>;
}

/**
 * Rank servers best-first.
 *
 * ORDER OF PRECEDENCE (each step only breaks ties left by the previous one):
 *   1. Not-yet-failed for this title  — a server that just failed goes last.
 *   2. Declared quality, highest first (maxHeight, then bitrateKbps). Currently
 *      unknown for every provider, so this step is a no-op until the data model
 *      carries it — see SERVER_QUALITY.
 *   3. Evidence: playback confirmed in this browser > provider recognises the
 *      title > provider answered the probe.
 *   4. Lowest observed failure rate from real playback in this browser.
 *   5. Fastest measured probe latency.
 *   6. Registry order, so the result is stable and never reshuffles per render.
 */
export function rankServers<T extends RankableServer>(
  servers: readonly T[],
  options: RankOptions = {}
): RankedServer<T>[] {
  const health = options.health ?? {};
  const tried = options.tried ?? new Set<string>();
  const order = new Map(servers.map((s, index) => [s.id, index]));

  const sorted = [...servers].sort((a, b) => {
    const aTried = tried.has(a.id) ? 1 : 0;
    const bTried = tried.has(b.id) ? 1 : 0;
    if (aTried !== bTried) return aTried - bTried;

    const quality = qualityRank(b) - qualityRank(a);
    if (quality !== 0) return quality;

    const bitrate = bitrateRank(b) - bitrateRank(a);
    if (bitrate !== 0) return bitrate;

    const evidence = evidenceRank(b) - evidenceRank(a);
    if (evidence !== 0) return evidence;

    const reliability = failureRate(health[a.id]) - failureRate(health[b.id]);
    if (Math.abs(reliability) > 0.001) return reliability;

    const aLatency = a.latencyMs ?? Number.POSITIVE_INFINITY;
    const bLatency = b.latencyMs ?? Number.POSITIVE_INFINITY;
    if (aLatency !== bLatency) return aLatency - bLatency;

    return (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0);
  });

  return sorted.map((server, rank) => ({
    server,
    rank,
    reason: tried.has(server.id)
      ? 'failing'
      : qualityRank(server) > 0
        ? 'quality'
        : server.live || server.verified
          ? 'confirmed'
          : failureRate(health[server.id]) > 0
            ? 'reliable'
            : server.online
              ? 'fast'
              : 'unproven',
  }));
}

/** The id `auto` would choose, or null for an empty list. */
export function bestServerId<T extends RankableServer>(
  servers: readonly T[],
  options: RankOptions = {}
): string | null {
  return rankServers(servers, options)[0]?.server.id ?? null;
}

// ─── Manual override (per title, per session) ─────────────────────────────────
// A deliberate pick must not be undone by a re-render, a season refetch, an
// episode change, or a remount caused by an unrelated island. sessionStorage is
// the right scope: it survives all of those and the whole tab's navigation, and
// it expires when the tab closes so a one-off choice does not become permanent.
// (The long-term memory is Continue Watching's `server` field, which already
// exists and is untouched by this module.)

const OVERRIDE_KEY = 'filmora.player.serverChoice.v1';

type OverrideMap = Record<string, string>;

function readOverrides(): OverrideMap {
  if (!canUseStorage('session')) return {};
  try {
    const raw = sessionStorage.getItem(OVERRIDE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as OverrideMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** Stable key for a title. Episode is deliberately excluded: a viewer who
 *  picked a server for a show expects it to hold across episodes. */
export function titleKey(type: 'movie' | 'tv', id: number | string): string {
  return `${type}:${id}`;
}

export function readServerOverride(key: string): string | null {
  return readOverrides()[key] ?? null;
}

export function writeServerOverride(key: string, serverId: string): void {
  if (!canUseStorage('session')) return;
  try {
    const map = readOverrides();
    map[key] = serverId;
    sessionStorage.setItem(OVERRIDE_KEY, JSON.stringify(map));
  } catch {
    /* private mode — the override lives in React state for this mount only */
  }
}

export function clearServerOverride(key: string): void {
  if (!canUseStorage('session')) return;
  try {
    const map = readOverrides();
    delete map[key];
    sessionStorage.setItem(OVERRIDE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}
