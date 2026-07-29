// src/components/react/useEmbedServers.ts — shared hook for the player islands.
//
// Asks the backend how each streaming server looks for a given title
// (/api/embed/servers) and exposes the list. Three rules make the server buttons
// dependable in every circumstance:
//
//  1. The list is never empty, and it is populated INSTANTLY. On every title /
//     episode change the hook seeds the full provider list from the curated
//     ranking synchronously, so the server picker is fully populated and "Auto"
//     has already chosen the cleanest working server in well under a second —
//     the datacenter probe then only refines badges and display order. If the
//     probe request itself fails we simply keep that seeded list, so the viewer
//     can always switch servers by hand.
//  2. The automatic pick is REASONED, not positional. `rankServers` orders the
//     list by declared quality, then by evidence (playback confirmed in this
//     browser > provider recognises the title > provider answered), then by the
//     failure rate this browser has actually observed, then by measured probe
//     latency. Taking `servers[0]` — what this hook used to do — is registry
//     order wearing a decision's clothes.
//  3. A manual pick always wins and survives. It is written to sessionStorage
//     keyed by title (see serverRanking.writeServerOverride), so a re-render, a
//     season refetch, an episode change or a remount caused by some unrelated
//     island cannot silently drop the viewer back onto auto-best.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  bestServerId,
  qualityFor,
  qualityLabel,
  rankServers,
  readHealth,
  readServerOverride,
  recordServerOutcome,
  titleKey as makeTitleKey,
  writeServerOverride,
  type HealthLedger,
  type RankedServer,
} from '../../lib/player/serverRanking';

export interface AvailableServer {
  id: string;
  name: string;
  label: string;
  /** Backend confirmed a real source URL for this exact title. */
  verified: boolean;
  /** Provider answered the backend probe for this title. */
  online: boolean;
  confidence: 'title' | 'live';
  /** Set client-side once the frame proves it is streaming (postMessage). */
  live?: boolean;
  /** Measured probe round-trip, or null when the probe failed / never ran. */
  latencyMs?: number | null;
  /** Declared quality. Null until the data model carries it — see SERVER_QUALITY. */
  maxHeight?: number | null;
  bitrateKbps?: number | null;
  qualityLabel?: string | null;
}

export type ServerStatus = 'idle' | 'checking' | 'ready' | 'error';

/**
 * Client-safe mirror of EMBED_SERVER_META (ids + display names only, no URLs,
 * no keys). Used when /api/embed/servers cannot be reached at all — without it
 * a network blip would leave the player with zero server buttons. Quality comes
 * from the shared registry so the fallback ranks exactly like a probed list.
 */
const FALLBACK_SERVERS: AvailableServer[] = (
  [
    { id: 'vidsrcin', name: 'VidSrc IN (Hindi)', label: 'Server 1', verified: false, online: false, confidence: 'title' },
    { id: 'vidlink', name: 'VidLink', label: 'Server 2', verified: false, online: false, confidence: 'title' },
    { id: 'vidfast', name: 'VidFast', label: 'Server 3', verified: false, online: false, confidence: 'live' },
    { id: 'videasy', name: 'Videasy', label: 'Server 4', verified: false, online: false, confidence: 'live' },
    { id: 'nexstream', name: 'NexStream', label: 'Server 5', verified: false, online: false, confidence: 'title' },
  ] satisfies AvailableServer[]
).map((s) => ({
  ...s,
  latencyMs: null,
  maxHeight: qualityFor(s.id).maxHeight,
  bitrateKbps: qualityFor(s.id).bitrateKbps,
  qualityLabel: qualityLabel(s.id),
}));

interface Args {
  type: 'movie' | 'tv';
  id: number | string;
  season?: number | null;
  episode?: number | null;
  /** Skip the request until the caller is ready (e.g. no episode chosen yet). */
  enabled?: boolean;
  /** Server id remembered from Continue Watching, preferred when still valid. */
  preferred?: string | null;
}

export function useEmbedServers({ type, id, season, episode, enabled = true, preferred }: Args) {
  const [servers, setServers] = useState<AvailableServer[]>([]);
  const [status, setStatus] = useState<ServerStatus>('idle');
  const [server, setServer] = useState<string | null>(null);
  /** True while the current selection is the one ranking chose for us. */
  const [isAuto, setIsAuto] = useState(true);
  const [health, setHealth] = useState<HealthLedger>({});
  const preferredRef = useRef(preferred ?? null);
  preferredRef.current = preferred ?? null;

  /** Per-title key for the manual-override memory (episode intentionally out). */
  const overrideKey = makeTitleKey(type, id);
  const overrideKeyRef = useRef(overrideKey);
  overrideKeyRef.current = overrideKey;

  /**
   * Servers already tried and failed for the title currently loaded. Ranked
   * last so failover never walks back onto a corpse. Owned here (rather than in
   * the island) so ranking and failover cannot disagree about what was tried.
   */
  const tried = useRef<Set<string>>(new Set());
  const healthRef = useRef<HealthLedger>({});

  // The ledger is read once on mount: it is written rarely (only on a real
  // playback outcome) and reading it on every rank would hit localStorage in a
  // render path.
  useEffect(() => {
    const ledger = readHealth();
    healthRef.current = ledger;
    setHealth(ledger);
  }, []);

  const key = type === 'tv' ? `${type}:${id}:${season}:${episode}` : `${type}:${id}`;

  /**
   * Adopt a list and decide what plays.
   *
   * Precedence: an explicit manual pick for this title (this session) → the
   * server remembered by Continue Watching → the best-ranked server.
   */
  const adopt = useCallback((list: AvailableServer[], nextStatus: ServerStatus) => {
    const safe = list.length > 0 ? list : FALLBACK_SERVERS;
    setServers(safe);

    const override = readServerOverride(overrideKeyRef.current);
    const remembered = preferredRef.current;
    const best = bestServerId(safe, { health: healthRef.current, tried: tried.current });

    const manual = safe.find((s) => s.id === override)?.id ?? null;
    const cw = safe.find((s) => s.id === remembered)?.id ?? null;
    const pick = manual ?? cw ?? best ?? safe[0]!.id;

    setServer(pick);
    setIsAuto(!manual && !cw);
    setStatus(nextStatus);
  }, []);

  const load = useCallback(
    (signal?: AbortSignal) => {
      const params = new URLSearchParams({ type, id: String(id) });
      if (type === 'tv') {
        params.set('season', String(season ?? 1));
        params.set('episode', String(episode ?? 1));
      }
      setStatus('checking');
      return fetch(`/api/embed/servers?${params.toString()}`, { signal })
        .then((r) => (r.ok ? (r.json() as Promise<{ servers?: AvailableServer[] }>) : Promise.reject(new Error(String(r.status)))))
        .then((data) => {
          adopt(data.servers ?? [], 'ready');
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          // Could not check — offer every server unverified rather than none.
          adopt(FALLBACK_SERVERS, 'error');
        });
    },
    [type, id, season, episode, adopt]
  );

  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      return;
    }
    // A new title/episode is a clean slate for failover: a provider that could
    // not serve the previous episode may serve this one.
    tried.current = new Set();
    // Seed the FULL server list and an auto pick SYNCHRONOUSLY, before the probe
    // answers. The datacenter probe is only advice (providers throttle our IP),
    // it can take seconds, and blocking on it would (a) leave a phone viewer
    // staring at an empty server sheet and (b) delay the automatic pick well past
    // a second. Seeding from the curated ranking means the list is visible and
    // "Auto" has already chosen the cleanest working server in <1s; the probe
    // then only enriches badges/latency and reshuffles the display order.
    adopt(FALLBACK_SERVERS, 'checking');
    const ac = new AbortController();
    load(ac.signal);
    return () => ac.abort();
    // `key` collapses the id/season/episode tuple into one dependency.
  }, [key, enabled, load, adopt]);

  /** The ranked list, best first. Recomputed only when the inputs change. */
  const ranked = useMemo<RankedServer<AvailableServer>[]>(
    () => rankServers(servers, { health, tried: tried.current }),
    [servers, health]
  );

  /** What auto-selection would choose right now. */
  const recommended = ranked[0]?.server.id ?? null;

  /**
   * Select a server because the viewer said so. Persisted per title for the
   * session so nothing can reset it back to auto.
   */
  const chooseServer = useCallback((next: string) => {
    setServer(next);
    setIsAuto(false);
    writeServerOverride(overrideKeyRef.current, next);
    // A deliberate pick re-opens the whole failover walk from here.
    tried.current = new Set();
  }, []);

  /**
   * Hand back control to automatic selection (the "Auto" pill).
   * Returns the id now playing so the caller can remount the engine.
   */
  const useAutoServer = useCallback((): string | null => {
    const best = bestServerId(servers, { health: healthRef.current, tried: tried.current });
    if (best) {
      setServer(best);
      setIsAuto(true);
    }
    return best;
  }, [servers]);

  /**
   * Record a real outcome for a server and, on failure, return the next-best
   * server to try (or null when every server has been tried for this title).
   *
   * Failure is recorded in two places on purpose: `tried` is per-title and
   * resets when the title changes, while the ledger is long-lived and shapes
   * ranking on later visits.
   */
  const reportOutcome = useCallback(
    (serverId: string, ok: boolean): string | null => {
      const ledger = recordServerOutcome(serverId, ok);
      healthRef.current = ledger;
      setHealth(ledger);
      if (ok) return null;
      tried.current.add(serverId);
      const next = rankServers(servers, { health: ledger, tried: tried.current })
        .map((entry) => entry.server)
        .find((candidate) => !tried.current.has(candidate.id));
      return next?.id ?? null;
    },
    [servers]
  );

  /** Manual retry of the current server: give it a genuine fresh attempt. */
  const resetTried = useCallback(() => {
    tried.current = new Set();
  }, []);

  /** Move to the next server in the list (used when a frame fails to load). */
  const nextServer = useCallback((): string | null => {
    if (servers.length < 2 || !server) return null;
    const idx = servers.findIndex((s) => s.id === server);
    const next = servers[(idx + 1) % servers.length];
    if (!next || next.id === server) return null;
    setServer(next.id);
    return next.id;
  }, [servers, server]);

  /**
   * Mark a server as proven from the client: the frame emitted a player event,
   * which is stronger evidence than any server-side probe can get for the
   * providers whose availability is not introspectable.
   */
  const confirmLive = useCallback((serverId: string) => {
    setServers((prev) =>
      prev.map((s) => (s.id === serverId && !s.live ? { ...s, live: true, online: true } : s))
    );
  }, []);

  return {
    servers,
    /** Ranked best-first, with the reason for each position. */
    ranked,
    /** What automatic selection would pick right now. */
    recommended,
    /** True while the current pick is automatic (no manual override in force). */
    isAuto,
    server,
    setServer,
    chooseServer,
    useAutoServer,
    reportOutcome,
    resetTried,
    status,
    retry: () => load(),
    nextServer,
    confirmLive,
  };
}
