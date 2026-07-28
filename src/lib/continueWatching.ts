// src/lib/continueWatching.ts — client-side "Continue Watching" store.
//
// A tiny localStorage-backed history so the site can offer Netflix-style resume.
// This module is browser-only (it touches localStorage) and imports NO server
// code, so it is safe to bundle into React islands. Every function no-ops
// gracefully when run during SSR (no `window`).

export interface ContinueEntry {
  /** TMDB id. */
  id: number;
  mediaType: 'movie' | 'tv';
  title: string;
  posterUrl: string | null;
  /** Last-watched season (tv only). */
  season?: number;
  /** Last-watched episode (tv only). */
  episode?: number;
  /** Which streaming server was last used. */
  server?: string;
  /**
   * Playback position in seconds, when the engine can report it (first-party
   * <video> or a YouTube trailer). Absent for third-party iframes, where the
   * position is inside a cross-origin document and unknowable.
   */
  positionSeconds?: number;
  /** Total duration in seconds, stored alongside the position for progress UI. */
  durationSeconds?: number;
  /** ISO timestamp of the last update — used for ordering. */
  updatedAt: string;
}

const KEY = 'filmora_continue';
const MAX = 30;

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage;
}

/** Read the full continue-watching list, newest first. */
export function getContinueWatching(): ContinueEntry[] {
  if (!canUseStorage()) return [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]') as ContinueEntry[];
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((e) => e && typeof e.id === 'number' && (e.mediaType === 'movie' || e.mediaType === 'tv'))
      .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
  } catch {
    return [];
  }
}

/**
 * Upsert an entry. Movies are keyed by id; series are keyed by id too (the
 * latest episode replaces the previous one, exactly like Netflix keeps a single
 * "Continue Watching" tile per show).
 */
export function saveContinueWatching(entry: Omit<ContinueEntry, 'updatedAt'>): void {
  if (!canUseStorage()) return;
  try {
    const list = getContinueWatching().filter(
      (e) => !(e.id === entry.id && e.mediaType === entry.mediaType)
    );
    list.unshift({ ...entry, updatedAt: new Date().toISOString() });
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    // Let other islands on the page (e.g. a rail) react live.
    window.dispatchEvent(new CustomEvent('filmora:continue-updated'));
  } catch {
    /* ignore quota / serialization errors */
  }
}

/** Look up the saved entry for a specific title, if any. */
export function getContinueEntry(
  id: number,
  mediaType: 'movie' | 'tv'
): ContinueEntry | null {
  return getContinueWatching().find((e) => e.id === id && e.mediaType === mediaType) ?? null;
}

/** Remove a title from the continue-watching list. */
export function removeContinueWatching(id: number, mediaType: 'movie' | 'tv'): void {
  if (!canUseStorage()) return;
  try {
    const list = getContinueWatching().filter(
      (e) => !(e.id === id && e.mediaType === mediaType)
    );
    localStorage.setItem(KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('filmora:continue-updated'));
  } catch {
    /* ignore */
  }
}
