// src/lib/player/format.ts — time formatting + track matching helpers.

import type { AudioTrackInfo, TextTrackInfo } from './types';
import { baseLanguage } from './languages';

/**
 * Clock label for the seek bar: m:ss under an hour, h:mm:ss above it (the same
 * rule Netflix and YouTube use, so the label never jumps width mid-title).
 */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Remaining-time label ("-1:23:45"), shown on the right of the seek bar. */
export function formatRemaining(current: number, duration: number): string {
  const left = Math.max(0, (duration || 0) - (current || 0));
  return `-${formatTime(left)}`;
}

/**
 * Spoken form for screen readers. "1:05:09" is read as a phone number by most
 * screen readers, so the slider gets this instead via aria-valuetext.
 */
export function spokenTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h} hour${h === 1 ? '' : 's'}`);
  if (m) parts.push(`${m} minute${m === 1 ? '' : 's'}`);
  if (s || parts.length === 0) parts.push(`${s} second${s === 1 ? '' : 's'}`);
  return parts.join(' ');
}

/**
 * Pick the track that best matches a remembered language tag.
 * Exact tag first ('pt-BR'), then the base language ('pt'), then nothing —
 * never a silent fallback to track 0, which would override the source's own
 * default and quietly change the audio language on every episode.
 */
export function resolveTrack<T extends AudioTrackInfo | TextTrackInfo>(
  tracks: T[],
  wanted: string | null
): T | null {
  if (!wanted || tracks.length === 0) return null;
  const target = wanted.toLowerCase();
  const exact = tracks.find((t) => t.lang.toLowerCase() === target);
  if (exact) return exact;
  const base = baseLanguage(wanted);
  if (!base) return null;
  return tracks.find((t) => baseLanguage(t.lang) === base) ?? null;
}

/** Human label for a bitrate estimate, used by the slow-network hint. */
export function formatBandwidth(bitsPerSecond: number | null): string | null {
  if (!bitsPerSecond || bitsPerSecond <= 0) return null;
  const mbps = bitsPerSecond / 1_000_000;
  return mbps >= 1 ? `${mbps.toFixed(1)} Mbps` : `${Math.round(bitsPerSecond / 1000)} kbps`;
}
