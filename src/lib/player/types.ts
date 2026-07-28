// src/lib/player/types.ts — the contract every playback engine implements.
//
// WHY AN ADAPTER LAYER
// -------------------
// Filmora plays video from three very different places and the control UI must
// not care which one is active:
//
//   'html5'   first-party <video> (progressive MP4/WebM, or HLS via hls.js /
//             native Safari). Full control: seek, rate, audio tracks, captions.
//   'youtube' a TMDB trailer through the YouTube IFrame API. Cross-origin, but
//             YouTube exposes a real command API, so almost everything works.
//   'embed'   a third-party streaming provider in a plain <iframe>. Same-origin
//             policy means we can read and set NOTHING inside it.
//
// The UI therefore renders from `PlayerCapabilities`, never from the engine id.
// A control whose capability is false is not rendered as a dead button — it is
// either omitted or replaced by an explanation (see TracksMenu / SeekBar).
// This is the honest alternative to faking a seek bar over an iframe.

/** Which engine is driving playback. */
export type EngineId = 'html5' | 'youtube' | 'embed';

/** Coarse playback state. `buffering` is a stall *during* playback. */
export type PlayerStatus =
  | 'idle' // nothing loaded yet (pre-play splash)
  | 'loading' // manifest / metadata / iframe document loading
  | 'ready' // loaded, not yet started
  | 'playing'
  | 'paused'
  | 'buffering'
  | 'ended'
  | 'error';

/** Machine-readable failure reason, so the UI can offer the right recovery. */
export type PlayerErrorKind =
  | 'network' // connection dropped / manifest or segment fetch failed
  | 'decode' // corrupt media
  | 'unsupported' // container or codec this browser cannot play
  | 'drm' // protected content, no key system
  | 'geo' // provider refused for this region
  | 'notfound' // no source at all for this title
  | 'aborted'
  | 'unknown';

export interface PlayerError {
  kind: PlayerErrorKind;
  /** English fallback message; the UI prefers a localised string per `kind`. */
  message: string;
  /** True when retrying the same source could plausibly work. */
  retryable: boolean;
}

/** One selectable audio rendition. */
export interface AudioTrackInfo {
  id: string;
  /** BCP-47 / ISO-639 tag as reported by the source ('hi', 'pt-BR', 'und'). */
  lang: string;
  /** Raw label from the manifest, if any ("Hindi 5.1", "Commentary"). */
  label?: string;
  /** Channel count when known — used to render a "5.1" chip. */
  channels?: number;
  active: boolean;
}

/** One selectable subtitle / caption track. */
export interface TextTrackInfo {
  id: string;
  lang: string;
  label?: string;
  /** 'captions' includes non-speech info (SDH); 'subtitles' is dialogue only. */
  kind: 'subtitles' | 'captions' | 'forced';
  active: boolean;
}

/** A subtitle line currently on screen, already split into display rows. */
export interface ActiveCue {
  id: string;
  lines: string[];
  /** Language tag of the owning track — drives font stack + `lang` attribute. */
  lang: string;
  /** Resolved text direction for this cue — set from the track language. */
  dir: 'ltr' | 'rtl';
}

/** Buffered time ranges, flattened for rendering. */
export interface BufferedRange {
  start: number;
  end: number;
}

/**
 * One selectable video rendition.
 *
 * Only engines that own the media can enumerate these. The embed engine cannot
 * and never will: the renditions are chosen inside a cross-origin document, so
 * there is nothing to read and nothing to set. See adapters/embed.ts.
 */
export interface QualityLevel {
  /** Stable id for selection — the engine's own level index, as a string. */
  id: string;
  /** Vertical resolution in pixels, when the manifest declares it. */
  height: number | null;
  /** Declared bandwidth for this rendition in bits/s. */
  bitrate: number | null;
  /** Display label, e.g. "1080p". */
  label: string;
  /** True when this is the rendition currently being rendered. */
  active: boolean;
}

/** Chapter markers that drive Skip Intro / Skip Recap / end-card timing. */
export interface TimeMarker {
  kind: 'intro' | 'recap' | 'credits';
  start: number;
  end: number;
}

/**
 * Everything the UI needs to render. Adapters push partial patches of this;
 * `usePlayer` owns the merged object.
 */
export interface PlayerSnapshot {
  status: PlayerStatus;
  currentTime: number;
  /** 0 when unknown (live, or an engine that cannot report duration). */
  duration: number;
  buffered: BufferedRange[];
  /** Effective volume 0–1 as the engine reports it (echo of our command). */
  volume: number;
  muted: boolean;
  rate: number;
  audioTracks: AudioTrackInfo[];
  textTracks: TextTrackInfo[];
  /** Cues we render ourselves (html5 only — see SubtitleLayer). */
  cues: ActiveCue[];
  error: PlayerError | null;
  /** Human-readable current quality, when the engine exposes it ("1080p"). */
  quality: string | null;
  /**
   * Every selectable rendition, highest first. Empty when the engine cannot
   * enumerate them (the third-party iframe never can — the renditions live in a
   * cross-origin document).
   */
  qualityLevels: QualityLevel[];
  /**
   * True while quality is being chosen adaptively rather than pinned by the
   * viewer. Filmora starts pinned to the highest rendition (see the html5
   * adapter) and only returns here if the viewer picks "Auto".
   */
  autoQuality: boolean;
  /** Estimated bandwidth in bits/s, when known — drives the slow-network hint. */
  bandwidth: number | null;
  /** True once the engine has proven it is actually playing media. */
  live: boolean;
  /**
   * The browser refused to start playback with sound, so the engine muted itself
   * to get the picture moving. Netflix/JioHotstar behaviour: play muted and show
   * a one-tap unmute prompt, rather than surfacing an error or sitting silent.
   * Cleared the moment the viewer unmutes.
   */
  autoplayBlocked: boolean;
}

export const EMPTY_SNAPSHOT: PlayerSnapshot = {
  status: 'idle',
  currentTime: 0,
  duration: 0,
  buffered: [],
  volume: 1,
  muted: false,
  rate: 1,
  audioTracks: [],
  textTracks: [],
  cues: [],
  error: null,
  quality: null,
  qualityLevels: [],
  autoQuality: false,
  bandwidth: null,
  live: false,
  autoplayBlocked: false,
};

/**
 * What an engine can actually do. Populated by the adapter, consumed by the UI.
 * `false` here is a promise that the corresponding control will not be shown.
 */
export interface PlayerCapabilities {
  /** Report currentTime / duration. Without it there is no seek bar at all. */
  time: boolean;
  /** Set currentTime (seek bar drag, ±10s, chapter skip, resume). */
  seek: boolean;
  /** Report buffered ranges (the lighter track on the seek bar). */
  buffered: boolean;
  /** Start / stop playback programmatically. */
  playback: boolean;
  /** Set playbackRate. */
  rate: boolean;
  /**
   * 'native' — we own the audio element, volume is exact.
   * 'relay'  — commands are posted to a foreign document that may ignore them.
   * 'none'   — no volume control is possible; do not render one.
   */
  volume: 'native' | 'relay' | 'none';
  /** Enumerate and switch audio renditions. */
  audioTracks: boolean;
  /** Enumerate and switch subtitle tracks. */
  textTracks: boolean;
  /** We render cues ourselves, so subtitle styling controls are meaningful. */
  subtitleStyling: boolean;
  /** Scrub preview thumbnails are obtainable. */
  thumbnails: boolean;
  /** Picture-in-Picture can be requested. */
  pip: boolean;
  /** Quality / bandwidth telemetry is available. */
  qualityInfo: boolean;
  /** A reliable `ended` signal exists (needed for auto Up Next + end card). */
  endedSignal: boolean;
}

/** No capabilities — adapters start from this and switch on what they support. */
export const NO_CAPS: PlayerCapabilities = {
  time: false,
  seek: false,
  buffered: false,
  playback: false,
  rate: false,
  volume: 'none',
  audioTracks: false,
  textTracks: false,
  subtitleStyling: false,
  thumbnails: false,
  pip: false,
  qualityInfo: false,
  endedSignal: false,
};

/** A first-party media file / manifest. */
export interface MediaSource {
  src: string;
  /** 'hls' | 'dash' | 'progressive' — decided by extension when omitted. */
  type?: 'hls' | 'dash' | 'progressive';
  /** Sidecar subtitle files served with permissive CORS. */
  textTracks?: Array<{
    src: string;
    lang: string;
    label?: string;
    kind?: 'subtitles' | 'captions' | 'forced';
    default?: boolean;
  }>;
  /**
   * WebVTT sprite sheet of scrub thumbnails (the "thumbnails" cue format used
   * by most CDNs: `image.jpg#xywh=0,0,160,90`). When absent we sample frames
   * from a hidden <video>, which only works for CORS-clean sources.
   */
  thumbnailsVtt?: string;
  /** Set when the media is served with permissive CORS (enables sampling). */
  crossOrigin?: 'anonymous' | 'use-credentials';
  /** Poster frame. */
  poster?: string | null;
}

/** Everything an engine needs to start. Exactly one branch is used. */
export type PlayerSource =
  | { engine: 'html5'; media: MediaSource; startAt?: number }
  | { engine: 'youtube'; videoId: string; startAt?: number; ccLang?: string | null }
  | { engine: 'embed'; url: string; frameKey: string };

/** Patch callback handed to adapters. */
export type SnapshotSink = (patch: Partial<PlayerSnapshot>) => void;

/**
 * The engine contract. Implementations live in src/lib/player/adapters/.
 * Every method must be safe to call at any time, including before `mount`
 * resolves and after `destroy` — the UI fires commands from timers and
 * keyboard handlers that can outlive a source switch.
 */
export interface PlayerAdapter {
  readonly engine: EngineId;
  readonly caps: PlayerCapabilities;
  /** Create DOM inside `host` and begin loading. */
  mount(host: HTMLElement, source: PlayerSource, sink: SnapshotSink): void | Promise<void>;
  /** Tear down listeners, timers and DOM. Must be idempotent. */
  destroy(): void;
  play(): void | Promise<void>;
  pause(): void;
  seek(seconds: number): void;
  setRate(rate: number): void;
  /** `volume` is 0–1. Mute is passed explicitly so relays can send both. */
  setVolume(volume: number, muted: boolean): void;
  selectAudioTrack(id: string): void;
  /** `null` turns subtitles off. */
  selectTextTrack(id: string | null): void;
  /**
   * Pin playback to one rendition, or pass `null` to hand quality back to
   * adaptive selection. Only implemented by engines that own the media.
   */
  selectQuality?(id: string | null): void;
  requestPictureInPicture?(): void;
  /** Returns a CSS background shorthand for the thumbnail at `seconds`. */
  thumbnailAt?(seconds: number): { url: string; x: number; y: number; w: number; h: number } | null;
}
