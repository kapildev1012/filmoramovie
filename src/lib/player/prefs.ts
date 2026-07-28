// src/lib/player/prefs.ts — persisted viewer preferences.
//
// One localStorage record for the whole player. Written on change (debounced by
// React's batching), read synchronously before first paint so nothing flashes at
// the wrong volume or subtitle size.
//
// Language memory is stored as a *tag*, not a track id: track ids differ between
// sources and episodes, so "remember the last selected language" is the only
// version that survives switching episode, server or engine. `resolveTrack()`
// below does the matching, preferring an exact tag then the base language.
//
// SSR-safe: every function no-ops without `window`.

const KEY = 'filmora.player.prefs.v2';

export type SubtitleSize = 'small' | 'medium' | 'large';
export type SubtitleBackdrop = 'none' | 'shadow' | 'box';

export interface PlayerPrefs {
  /** 0–1. Kept separately from `muted` so unmuting restores the old level. */
  volume: number;
  muted: boolean;
  rate: number;
  /** CSS filter brightness applied to our own stage (works on every engine). */
  brightness: number;
  /** Crop-zoom of the video surface, 1–2.5. */
  zoom: number;
  /** Touch drag zones (brightness left / volume right) enabled. */
  gestures: boolean;
  /** Last chosen audio language tag, or null for "source default". */
  audioLang: string | null;
  /** Last chosen subtitle language tag; null = explicitly off. */
  subtitleLang: string | null;
  /** Whether subtitles were on at all — distinguishes "off" from "never set". */
  subtitlesEnabled: boolean;
  subtitleSize: SubtitleSize;
  subtitleBackdrop: SubtitleBackdrop;
  /** Auto-play the next episode when one finishes. */
  autoplayNext: boolean;
  /**
   * Preferred video quality as a vertical resolution (e.g. 720), or null for
   * "highest available / adaptive".
   *
   * Stored as a HEIGHT rather than a level index because indices differ between
   * titles and even between renditions of the same title — a remembered index
   * would silently mean a different quality on the next video. Height is the only
   * form of this preference that survives a source change.
   */
  preferredQualityHeight: number | null;
}

export const DEFAULT_PREFS: PlayerPrefs = {
  volume: 1,
  muted: false,
  rate: 1,
  brightness: 1,
  zoom: 1,
  gestures: true,
  audioLang: null,
  subtitleLang: null,
  subtitlesEnabled: false,
  subtitleSize: 'medium',
  subtitleBackdrop: 'shadow',
  autoplayNext: true,
  // null = "highest the source can deliver". This is the product default; a
  // viewer who pins a lower rendition overrides it and that choice persists.
  preferredQualityHeight: null,
};

export const BRIGHTNESS_MIN = 0.3;
export const BRIGHTNESS_MAX = 1.8;
export const ZOOM_MIN = 1;
export const ZOOM_MAX = 2.5;
export const RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

function isSize(v: unknown): v is SubtitleSize {
  return v === 'small' || v === 'medium' || v === 'large';
}
function isBackdrop(v: unknown): v is SubtitleBackdrop {
  return v === 'none' || v === 'shadow' || v === 'box';
}

/** Read prefs, repairing anything out of range or from an older shape. */
export function readPrefs(): PlayerPrefs {
  if (typeof window === 'undefined' || !window.localStorage) return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    const p = JSON.parse(raw) as Partial<PlayerPrefs>;
    return {
      volume: clamp(Number(p.volume ?? 1), 0, 1),
      muted: !!p.muted,
      rate: RATES.includes(Number(p.rate) as (typeof RATES)[number]) ? Number(p.rate) : 1,
      brightness: clamp(Number(p.brightness) || 1, BRIGHTNESS_MIN, BRIGHTNESS_MAX),
      zoom: clamp(Number(p.zoom) || 1, ZOOM_MIN, ZOOM_MAX),
      gestures: p.gestures !== false,
      audioLang: typeof p.audioLang === 'string' ? p.audioLang : null,
      subtitleLang: typeof p.subtitleLang === 'string' ? p.subtitleLang : null,
      subtitlesEnabled: !!p.subtitlesEnabled,
      subtitleSize: isSize(p.subtitleSize) ? p.subtitleSize : 'medium',
      subtitleBackdrop: isBackdrop(p.subtitleBackdrop) ? p.subtitleBackdrop : 'shadow',
      autoplayNext: p.autoplayNext !== false,
      preferredQualityHeight:
        Number.isFinite(Number(p.preferredQualityHeight)) && Number(p.preferredQualityHeight) > 0
          ? Number(p.preferredQualityHeight)
          : null,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function writePrefs(prefs: PlayerPrefs): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* private mode / quota — preferences simply do not persist */
  }
}
