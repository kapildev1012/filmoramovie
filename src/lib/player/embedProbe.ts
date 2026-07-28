// src/lib/player/embedProbe.ts — client-side pre-flight for the embed engine.
//
// THE PROBLEM THIS SOLVES
// A viewer presses Play, the iframe loads, and the provider renders "No sources
// found" — a dead rectangle the page has no way to see, because the document is
// cross-origin. Failing over only AFTER a visible failure costs the viewer a
// wasted 5 seconds per bad server.
//
// WHAT CAN AND CANNOT BE CHECKED FROM A BROWSER (no wishful thinking here)
//   ✗ fetch(providerUrl)                  → blocked by CORS, throws.
//   ✗ fetch(providerUrl, {mode:'no-cors'}) → opaque: status is ALWAYS 0, so a 404
//                                            reads exactly like a working page.
//                                            Useful for one thing only: proving
//                                            the host is reachable at all.
//   ✓ /api/embed/probe                    → our own origin, so the JSON is
//                                            readable, and the server saw the
//                                            real status code (404/403/5xx).
//   ✓ iframe 'load' + a deadline          → catches a frame that never renders.
//   ✓ postMessage from the frame          → the only positive proof of playback;
//                                            handled in adapters/embed.ts.
//
// So the pre-flight below is: ask our own backend for real statuses, treat only
// the unambiguous failures (404/410, unreachable) as disqualifying, and let the
// iframe deadline + player telemetry decide the rest. A throttled probe (403/429
// from a datacenter IP) is explicitly NOT a failure — the same URL usually plays
// fine from the viewer's connection, and dropping a working server on that
// evidence is worse than trying it.
//
// Client-safe: no secrets, no provider URLs, only opaque server ids.

/** Mirrors ProbeVerdict in src/lib/embed.ts (kept local so this stays client-safe). */
export type ProbeVerdict = 'ok' | 'missing' | 'blocked' | 'error' | 'unreachable' | 'unknown';

export interface ServerVerdict {
  server: string;
  verdict: ProbeVerdict;
  status: number | null;
  latencyMs: number | null;
  /**
   * How much this provider's status is worth.
   *
   * 'title' — the provider answers differently for ids it does not know (VidLink
   *           replies 5xx, CodeSpecter returns null meta), so an error status is
   *           evidence about THIS title.
   * 'live'  — the provider answers identically for real and bogus ids, so only a
   *           404 or an unreachable host means anything.
   */
  confidence: 'title' | 'live';
  /**
   * False only when the probe is PROOF that sending a viewer here is pointless
   * (404/410 for this exact title, an unreachable host, or a 5xx from a
   * title-aware provider). Everything else — including a throttled or unchecked
   * server — stays playable, because a datacenter probe is not the viewer's
   * browser.
   */
  playable: boolean;
}

export interface ProbeTarget {
  type: 'movie' | 'tv';
  id: number | string;
  season?: number | null;
  episode?: number | null;
}

/** How long the whole pre-flight may take before the player stops waiting. */
export const PREFLIGHT_TIMEOUT_MS = 3500;

/**
 * Verdicts that disqualify a server outright, whatever the provider.
 * Everything else is "not proven bad" — see isPlayable for the one nuance.
 */
const HARD_FAILURES: ReadonlySet<ProbeVerdict> = new Set<ProbeVerdict>(['missing', 'unreachable']);

export function isPlayable(verdict: ProbeVerdict, confidence: 'title' | 'live' = 'live'): boolean {
  if (HARD_FAILURES.has(verdict)) return false;
  // A 5xx from a provider that recognises titles is how it says "I don't have
  // this one" (VidLink answers 500 for an unknown TMDB id — verified against the
  // live endpoint). From a 'live'-confidence provider the same status is just a
  // bad minute on their edge and proves nothing, so it is not disqualifying.
  if (verdict === 'error' && confidence === 'title') return false;
  return true;
}

function probeUrl(target: ProbeTarget, servers: readonly string[]): string {
  const params = new URLSearchParams({ type: target.type, id: String(target.id) });
  if (target.type === 'tv') {
    params.set('season', String(target.season ?? 1));
    params.set('episode', String(target.episode ?? 1));
  }
  if (servers.length > 0) params.set('servers', servers.join(','));
  return `/api/embed/probe?${params.toString()}`;
}

/**
 * Ask the backend for the real HTTP status of each server for one exact title.
 *
 * Never rejects: a failed pre-flight must leave the player exactly as capable as
 * it was without one, so every server comes back 'unknown' (and playable) when
 * the request itself fails or times out.
 */
export async function probeServers(
  target: ProbeTarget,
  servers: readonly string[],
  options: { signal?: AbortSignal; timeoutMs?: number } = {}
): Promise<ServerVerdict[]> {
  const unknown = (): ServerVerdict[] =>
    servers.map((server) => ({
      server,
      verdict: 'unknown' as const,
      status: null,
      latencyMs: null,
      confidence: 'live' as const,
      playable: true,
    }));

  if (servers.length === 0) return [];

  const ac = new AbortController();
  const abort = () => ac.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, options.timeoutMs ?? PREFLIGHT_TIMEOUT_MS);

  try {
    const response = await fetch(probeUrl(target, servers), { signal: ac.signal });
    if (!response.ok) return unknown();
    const data = (await response.json()) as {
      results?: Array<{
        server?: string;
        verdict?: ProbeVerdict;
        status?: number | null;
        latencyMs?: number | null;
        confidence?: 'title' | 'live';
      }>;
    };
    type RawResult = {
      server: string;
      verdict?: ProbeVerdict;
      status?: number | null;
      latencyMs?: number | null;
      confidence?: 'title' | 'live';
    };
    const byId = new Map<string, RawResult>(
      (data.results ?? [])
        .filter((r): r is RawResult => typeof r.server === 'string')
        .map((r) => [r.server, r])
    );
    return servers.map((server) => {
      const hit = byId.get(server);
      const verdict: ProbeVerdict = hit?.verdict ?? 'unknown';
      const confidence = hit?.confidence ?? 'live';
      return {
        server,
        verdict,
        status: hit?.status ?? null,
        latencyMs: hit?.latencyMs ?? null,
        confidence,
        playable: isPlayable(verdict, confidence),
      };
    });
  } catch {
    return unknown();
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
  }
}

/**
 * First server in the caller's PRIORITY ORDER that the probe did not disqualify.
 *
 * Order comes from the caller (the player passes its ranked list — see
 * serverRanking.ts), so this never re-decides priority; it only removes the
 * servers that were proven pointless, and prefers a confirmed 'ok' over an
 * unproven one when both survive.
 */
export function firstPlayable(
  order: readonly string[],
  verdicts: readonly ServerVerdict[],
  exclude: ReadonlySet<string> = new Set()
): string | null {
  const map = new Map(verdicts.map((v) => [v.server, v]));
  const eligible = order.filter((id) => !exclude.has(id) && (map.get(id)?.playable ?? true));
  return eligible.find((id) => map.get(id)?.verdict === 'ok') ?? eligible[0] ?? null;
}

/**
 * Reachability ping from the VIEWER's browser, used as a second opinion.
 *
 * `mode: 'no-cors'` means the response is opaque — there is no status to read,
 * so this can only distinguish "the host answered something" from "the request
 * never completed". That is still worth having: it is measured on the viewer's
 * own connection, which is the one that matters, and it catches a provider that
 * is blocked locally (ISP/DNS/extension) while answering our server fine.
 *
 * Resolves true when the request completed, false on network failure or timeout.
 */
export async function reachableFromBrowser(url: string, timeoutMs = 2500): Promise<boolean> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    await fetch(url, {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      redirect: 'follow',
      referrerPolicy: 'no-referrer',
      signal: ac.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
