// src/components/react/useEmbedServers.ts — shared hook for the player islands.
//
// Asks the backend how each streaming server looks for a given title
// (/api/embed/servers) and exposes the list. Two rules make the server buttons
// dependable in every circumstance:
//
//  1. The list is never empty. The backend returns all providers (probe results
//     are flags, not a filter) and if the request itself fails we fall back to
//     the static list below, so the viewer can always switch servers by hand.
//  2. Nothing is silently preferred. Order comes from the backend (confirmed
//     first); a server remembered from Continue Watching wins if it is listed.
import { useCallback, useEffect, useRef, useState } from 'react';

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
}

export type ServerStatus = 'idle' | 'checking' | 'ready' | 'error';

/**
 * Client-safe mirror of EMBED_SERVER_META (ids + display names only, no URLs,
 * no keys). Used when /api/embed/servers cannot be reached at all — without it
 * a network blip would leave the player with zero server buttons.
 */
const FALLBACK_SERVERS: AvailableServer[] = [
  { id: 'nexstream', name: 'NexStream', label: 'Server 1', verified: false, online: false, confidence: 'title' },
  { id: 'vidlink', name: 'VidLink', label: 'Server 2', verified: false, online: false, confidence: 'title' },
  { id: 'videasy', name: 'Videasy', label: 'Server 3', verified: false, online: false, confidence: 'live' },
  { id: 'vidfast', name: 'VidFast', label: 'Server 4', verified: false, online: false, confidence: 'live' },
];

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
  const preferredRef = useRef(preferred ?? null);
  preferredRef.current = preferred ?? null;

  const key = type === 'tv' ? `${type}:${id}:${season}:${episode}` : `${type}:${id}`;

  /** Adopt a list and pick the remembered server if it is in it. */
  const adopt = useCallback((list: AvailableServer[], nextStatus: ServerStatus) => {
    const safe = list.length > 0 ? list : FALLBACK_SERVERS;
    setServers(safe);
    const wanted = preferredRef.current;
    const pick = safe.find((s) => s.id === wanted) ?? safe[0];
    setServer(pick.id);
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
    const ac = new AbortController();
    load(ac.signal);
    return () => ac.abort();
    // `key` collapses the id/season/episode tuple into one dependency.
  }, [key, enabled, load]);

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

  return { servers, server, setServer, status, retry: () => load(), nextServer, confirmLive };
}
