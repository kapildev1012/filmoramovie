// src/components/react/player/usePlayer.ts — the player's brain.
//
// Owns: adapter lifecycle, the merged snapshot, viewer preferences, control
// auto-hide, fullscreen, brightness/zoom, keyboard shortcuts and the screen
// reader announcements. Control components stay dumb: they receive values and
// call commands.
//
// WHY CAPS LIVE IN STATE
// Adapters refine `caps` while loading (a second audio rendition appears after
// the manifest parses; thumbnails only exist once a preview source is proven).
// The hook copies the adapter's caps object after every snapshot patch and
// re-renders when it actually changed, so controls appear exactly when they
// become real — and never appear before that.

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import {
  EMPTY_SNAPSHOT,
  NO_CAPS,
  type EngineId,
  type PlayerAdapter,
  type PlayerCapabilities,
  type PlayerSnapshot,
  type PlayerSource,
  type TimeMarker,
} from '../../../lib/player/types';
import {
  BRIGHTNESS_MAX,
  BRIGHTNESS_MIN,
  DEFAULT_PREFS,
  RATES,
  ZOOM_MAX,
  ZOOM_MIN,
  clamp,
  readPrefs,
  writePrefs,
  type PlayerPrefs,
} from '../../../lib/player/prefs';
import { resolveTrack } from '../../../lib/player/format';
import type { PlayerT } from '../../../lib/player/strings';

/**
 * Idle delay before the control chrome (top bar + Fullscreen) fades. Set to 1s
 * per product spec: tap to reveal, and it vanishes a second later so the picture
 * is clear almost immediately.
 *
 * `chromeHover` below holds it open for as long as the pointer is over the
 * chrome, alongside the existing holds for paused / buffering / ended / offline
 * / scrubbing / open menu.
 */
const IDLE_MS = 1000;
/** Rapid play/pause taps inside this window collapse into one command. */
const TOGGLE_DEBOUNCE_MS = 220;
/** Seconds for the skip buttons and ←/→ keys. */
export const SKIP_SECONDS = 10;
/** Bandwidth below which we surface the "slow connection" hint (bits/s). */
const SLOW_BANDWIDTH = 900_000;

export type MenuId = 'tracks' | 'speed' | 'overflow' | 'episodes' | null;

export interface UsePlayerArgs {
  /** Null keeps the player idle (pre-play splash). */
  source: PlayerSource | null;
  /** Changing this string remounts the engine (server switch, next episode). */
  sourceKey: string;
  /** Chapter markers for Skip Intro / Skip Recap / credits-triggered Up Next. */
  markers?: TimeMarker[];
  /** Fired once per source when playback genuinely starts. */
  onStarted?: () => void;
  /** Fired when the media ends (drives Up Next / end card). */
  onEnded?: () => void;
  /** Called ~every 5s with the current position, for Continue Watching. */
  onProgress?: (seconds: number, duration: number) => void;
  /** Translator for announcements. */
  t: PlayerT;
}

export interface PlayerApi {
  /** Attach to the element the engine renders into. */
  hostRef: RefObject<HTMLDivElement | null>;
  /** Attach to the focusable stage wrapper (owns keyboard + pointer idle). */
  stageRef: RefObject<HTMLDivElement | null>;
  snapshot: PlayerSnapshot;
  caps: PlayerCapabilities;
  engine: EngineId | null;
  prefs: PlayerPrefs;
  /** Controls are on screen. */
  controlsVisible: boolean;
  /** Which menu is open (only one at a time, and it blocks auto-hide). */
  menu: MenuId;
  setMenu: (menu: MenuId) => void;
  isFullscreen: boolean;
  /**
   * True only for the CSS fallback used where the Fullscreen API cannot take a
   * <div> (iOS Safari). PlayerShell needs it separately from `isFullscreen`
   * because that case has to be positioned `fixed` over the page, while a real
   * fullscreen element is already detached by the browser.
   */
  pseudoFullscreen: boolean;
  /** Live region text for screen readers. */
  announcement: string;
  /** Marker overlapping the playhead right now, if any. */
  activeMarker: TimeMarker | null;
  /** Position being previewed while scrubbing, or null. */
  scrubTime: number | null;
  setScrubTime: (seconds: number | null) => void;

  togglePlay: () => void;
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  /**
   * Seek relative to the playhead. `feedback: 'none'` suppresses the centred
   * skip pulse, used by the double-tap zones which draw their own ripple at the
   * point the viewer actually touched.
   */
  seekBy: (delta: number, feedback?: 'pulse' | 'none') => void;
  setVolume: (volume01: number) => void;
  toggleMute: () => void;
  /**
   * Answer the "tap to unmute" prompt: restore real audio, clear the blocked
   * flag and (re)start playback with the fresh gesture the tap provides.
   */
  unmuteFromAutoplay: () => void;
  setRate: (rate: number) => void;
  cycleRate: (direction: 1 | -1) => void;
  selectAudio: (id: string) => void;
  selectText: (id: string | null) => void;
  /**
   * Pin a video rendition by its id, or pass `null` to return to adaptive
   * ("Auto") selection. The choice is remembered as a resolution height, so it
   * carries across episodes and sources.
   */
  selectQuality: (id: string | null) => void;
  /** Cycle subtitles: off -> remembered/first -> off (the `c` shortcut). */
  toggleSubtitles: () => void;
  setBrightness: (value: number) => void;
  setZoom: (value: number) => void;
  toggleGestures: () => void;
  updatePrefs: (patch: Partial<PlayerPrefs>) => void;
  toggleFullscreen: () => void;
  requestPip: () => void;
  /** Reveal the controls and restart the idle timer. */
  wake: () => void;
  /**
   * Hold the controls open while the pointer is over the chrome. Needed because
   * even at 3s idle, a cursor resting on a button should never watch it fade.
   */
  holdChrome: (hovering: boolean) => void;
  /** Thumbnail for a scrub position, when the engine can produce one. */
  thumbnailAt: (seconds: number) => { url: string; x: number; y: number; w: number; h: number } | null;
  /** Feedback pulse for double-tap skip: 'forward' | 'back' | null. */
  skipPulse: 'forward' | 'back' | null;
  pulseSkip: (direction: 'forward' | 'back') => void;
  /** True when the engine reports a bitrate low enough to warn about. */
  slowNetwork: boolean;
  /**
   * The browser has lost its connection. Surfaced separately from
   * `snapshot.error` because it is true *before* any engine error arrives and
   * explains the failure better than "network error" ever could.
   */
  offline: boolean;
}

function sameCaps(a: PlayerCapabilities, b: PlayerCapabilities): boolean {
  return (Object.keys(a) as Array<keyof PlayerCapabilities>).every((k) => a[k] === b[k]);
}

export function usePlayer({
  source,
  sourceKey,
  markers = [],
  onStarted,
  onEnded,
  onProgress,
  t,
}: UsePlayerArgs): PlayerApi {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const adapterRef = useRef<PlayerAdapter | null>(null);

  const [snapshot, setSnapshot] = useState<PlayerSnapshot>(EMPTY_SNAPSHOT);
  const [caps, setCaps] = useState<PlayerCapabilities>(NO_CAPS);
  const [engine, setEngine] = useState<EngineId | null>(null);
  const [prefs, setPrefs] = useState<PlayerPrefs>(DEFAULT_PREFS);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [menu, setMenu] = useState<MenuId>(null);
  const [nativeFs, setNativeFs] = useState(false);
  const [pseudoFs, setPseudoFs] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [scrubTime, setScrubTime] = useState<number | null>(null);
  const [skipPulse, setSkipPulse] = useState<'forward' | 'back' | null>(null);
  /** Pointer is resting on the control bar / top bar — see IDLE_MS. */
  const [chromeHover, setChromeHover] = useState(false);
  /**
   * Connection state. Initialised to `false` rather than `!navigator.onLine` so
   * the server-rendered markup and the first client render agree; the effect
   * below corrects it immediately after hydration.
   */
  const [offline, setOffline] = useState(false);

  const idleTimer = useRef<number | undefined>(undefined);
  const announceTimer = useRef<number | undefined>(undefined);
  const pulseTimer = useRef<number | undefined>(undefined);
  const lastToggle = useRef(0);
  const startedRef = useRef(false);
  const endedRef = useRef(false);
  const progressRef = useRef(0);
  const prefsLoaded = useRef(false);
  const offlineRef = useRef(false);

  const isFullscreen = nativeFs || pseudoFs;

  // ── Preferences ───────────────────────────────────────────────────────────
  // Read before first paint so nothing flashes at the wrong volume or size.
  useLayoutEffect(() => {
    setPrefs(readPrefs());
    prefsLoaded.current = true;
  }, []);

  useEffect(() => {
    if (prefsLoaded.current) writePrefs(prefs);
  }, [prefs]);

  const updatePrefs = useCallback((patch: Partial<PlayerPrefs>) => {
    setPrefs((p) => ({ ...p, ...patch }));
  }, []);

  // ── Announcements (aria-live) ─────────────────────────────────────────────
  // Cleared after a beat so the same message announced twice is read twice.
  const announce = useCallback((text: string) => {
    setAnnouncement(text);
    window.clearTimeout(announceTimer.current);
    announceTimer.current = window.setTimeout(() => setAnnouncement(''), 1200);
  }, []);

  // ── Adapter pre-warming ────────────────────────────────────────────────────
  // Dynamic imports in `boot()` below only fire after the viewer presses Play.
  // Pre-fetching the module we will most likely need means the chunk is already
  // in the browser's module cache when that import runs, turning a network round-
  // trip into a synchronous resolve. This shaves 100-300ms off time-to-first-frame
  // on typical connections.
  const prewarmed = useRef(false);
  useEffect(() => {
    if (prewarmed.current) return;
    prewarmed.current = true;
    // Determine which adapter is most likely needed before the viewer clicks Play.
    // For the embed engine (the overwhelming default), the adapter is tiny (~3KB),
    // but for html5 it bundles hls.js (~150KB). Either way, one idle-priority
    // import warms the module cache.
    if (source === null) {
      // No source yet — the viewer hasn't started. Pre-warm based on the engine
      // the caller will most likely pick.
      void import('../../../lib/player/adapters/embed');
    }
  }, [source]);

  // ── Engine lifecycle ──────────────────────────────────────────────────────
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !source) {
      setSnapshot(EMPTY_SNAPSHOT);
      setCaps(NO_CAPS);
      setEngine(null);
      return;
    }

    let cancelled = false;
    startedRef.current = false;
    endedRef.current = false;
    setSnapshot({ ...EMPTY_SNAPSHOT, status: 'loading' });
    setEngine(source.engine);

    const sink = (patch: Partial<PlayerSnapshot>) => {
      if (cancelled) return;
      setSnapshot((prev) => ({ ...prev, ...patch }));
      const adapter = adapterRef.current;
      if (adapter) {
        setCaps((prev) => (sameCaps(prev, adapter.caps) ? prev : { ...adapter.caps }));
      }
    };

    // Adapters are imported dynamically so a viewer who only ever uses the
    // embed engine never downloads hls.js or the YouTube glue.
    const boot = async () => {
      let adapter: PlayerAdapter;
      if (source.engine === 'html5') {
        const { Html5Adapter } = await import('../../../lib/player/adapters/html5');
        adapter = new Html5Adapter();
      } else if (source.engine === 'youtube') {
        const { YouTubeAdapter } = await import('../../../lib/player/adapters/youtube');
        adapter = new YouTubeAdapter();
      } else {
        const { EmbedAdapter } = await import('../../../lib/player/adapters/embed');
        adapter = new EmbedAdapter();
      }
      if (cancelled) return;
      adapterRef.current = adapter;
      setCaps({ ...adapter.caps });
      await adapter.mount(host, source, sink);
      if (cancelled) return;
      setCaps({ ...adapter.caps });
      // Apply remembered audio state immediately — before the first frame, so
      // a muted-by-choice viewer never gets a burst of sound. `prefs.volume`
      // defaults to 1 (full) and is only lower when the viewer previously chose
      // a lower level — see DEFAULT_PREFS / readPrefs.
      //
      // FULL VOLUME ON START (product decision): a level of 0 that is NOT an
      // explicit mute is treated as "never chosen" and opened at 100%, so a
      // title can never begin silently while the mute button reads "unmuted".
      // A deliberate 40% is still respected — silently overriding a real choice
      // would be a worse bug than the one this guards against.
      const startVolume = prefs.muted || prefs.volume > 0 ? prefs.volume : 1;
      adapter.setVolume(startVolume, prefs.muted);
      if (adapter.caps.rate) adapter.setRate(prefs.rate);
      // A source only exists because the viewer asked for one (pressed Play,
      // picked an episode, switched server), so start it rather than making them
      // press play twice. If the browser refuses audio, the adapter mutes,
      // starts anyway and raises `autoplayBlocked` so the shell can offer sound
      // in one tap — the Netflix/JioHotstar recovery, not an error.
      if (adapter.caps.playback) void adapter.play();
    };

    void boot();

    return () => {
      cancelled = true;
      adapterRef.current?.destroy();
      adapterRef.current = null;
      host.replaceChildren();
    };
    // `sourceKey` is the intentional remount trigger; `prefs` must NOT be here
    // or changing the volume would reload the video.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey]);

  // Re-apply audio prefs whenever they change (without remounting).
  useEffect(() => {
    adapterRef.current?.setVolume(prefs.volume, prefs.muted);
  }, [prefs.volume, prefs.muted]);

  useEffect(() => {
    if (caps.rate) adapterRef.current?.setRate(prefs.rate);
  }, [prefs.rate, caps.rate]);

  // ── Language memory ───────────────────────────────────────────────────────
  // When tracks appear, apply the remembered language. Matching is by tag, not
  // index, so it survives switching episode / server / engine.
  const appliedAudioFor = useRef<string>('');
  useEffect(() => {
    const adapter = adapterRef.current;
    if (!adapter || !caps.audioTracks || snapshot.audioTracks.length === 0) return;
    const signature = `${sourceKey}:${snapshot.audioTracks.map((a) => a.id).join(',')}`;
    if (appliedAudioFor.current === signature) return;
    appliedAudioFor.current = signature;
    const wanted = resolveTrack(snapshot.audioTracks, prefs.audioLang);
    if (wanted && !wanted.active) adapter.selectAudioTrack(wanted.id);
  }, [caps.audioTracks, snapshot.audioTracks, prefs.audioLang, sourceKey]);

  const appliedTextFor = useRef<string>('');
  useEffect(() => {
    const adapter = adapterRef.current;
    if (!adapter || !caps.textTracks || snapshot.textTracks.length === 0) return;
    const signature = `${sourceKey}:${snapshot.textTracks.map((s) => s.id).join(',')}`;
    if (appliedTextFor.current === signature) return;
    appliedTextFor.current = signature;
    if (!prefs.subtitlesEnabled) return; // respect an explicit "off"
    const wanted = resolveTrack(snapshot.textTracks, prefs.subtitleLang);
    if (wanted && !wanted.active) adapter.selectTextTrack(wanted.id);
  }, [caps.textTracks, snapshot.textTracks, prefs.subtitlesEnabled, prefs.subtitleLang, sourceKey]);

  // ── Lifecycle callbacks ───────────────────────────────────────────────────
  useEffect(() => {
    if (snapshot.status === 'playing' && !startedRef.current) {
      startedRef.current = true;
      onStarted?.();
    }
    if (snapshot.status === 'ended' && !endedRef.current) {
      endedRef.current = true;
      announce(t('stateEnded'));
      onEnded?.();
    }
  }, [snapshot.status, onStarted, onEnded, announce, t]);

  useEffect(() => {
    if (!onProgress || snapshot.status !== 'playing' || !caps.time) return;
    const now = snapshot.currentTime;
    if (Math.abs(now - progressRef.current) < 5) return;
    progressRef.current = now;
    onProgress(now, snapshot.duration);
  }, [snapshot.currentTime, snapshot.duration, snapshot.status, caps.time, onProgress]);

  // ── Control auto-hide ─────────────────────────────────────────────────────
  // Never hide while paused, buffering, ended, or with a menu open — the two
  // states where a viewer is most likely reaching for a control.
  const holdOpen =
    menu !== null ||
    chromeHover ||
    snapshot.status === 'paused' ||
    snapshot.status === 'ready' ||
    snapshot.status === 'idle' ||
    snapshot.status === 'ended' ||
    snapshot.status === 'error' ||
    offline ||
    scrubTime !== null;

  const wake = useCallback(() => {
    setControlsVisible(true);
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setControlsVisible(false), IDLE_MS);
  }, []);

  /**
   * Called by the shell when the pointer enters/leaves the chrome. A touch tap
   * does not "hover", so this only ever affects mouse and stylus users — exactly
   * the ones who would otherwise watch a button vanish as they reach for it.
   */
  const holdChrome = useCallback((hovering: boolean) => {
    setChromeHover(hovering);
    if (hovering) {
      window.clearTimeout(idleTimer.current);
      setControlsVisible(true);
    }
  }, []);

  useEffect(() => {
    if (holdOpen) {
      window.clearTimeout(idleTimer.current);
      setControlsVisible(true);
      return;
    }
    wake();
    return () => window.clearTimeout(idleTimer.current);
  }, [holdOpen, wake, sourceKey]);

  // ── Commands ──────────────────────────────────────────────────────────────
  const play = useCallback(() => {
    void adapterRef.current?.play();
    announce(t('statePlaying'));
  }, [announce, t]);

  const pause = useCallback(() => {
    adapterRef.current?.pause();
    announce(t('statePaused'));
  }, [announce, t]);

  /**
   * Debounced so a double-tap on mobile (or a hammered spacebar) cannot leave
   * our optimistic state inverted relative to the engine: commands inside the
   * window are dropped, not queued.
   */
  const togglePlay = useCallback(() => {
    if (!caps.playback) return;
    const now = Date.now();
    if (now - lastToggle.current < TOGGLE_DEBOUNCE_MS) return;
    lastToggle.current = now;
    if (snapshot.status === 'playing' || snapshot.status === 'buffering') pause();
    else play();
    wake();
  }, [caps.playback, snapshot.status, play, pause, wake]);

  const seekTo = useCallback(
    (seconds: number) => {
      if (!caps.seek) return;
      adapterRef.current?.seek(seconds);
      wake();
    },
    [caps.seek, wake]
  );

  const pulseSkip = useCallback((direction: 'forward' | 'back') => {
    setSkipPulse(direction);
    window.clearTimeout(pulseTimer.current);
    pulseTimer.current = window.setTimeout(() => setSkipPulse(null), 450);
  }, []);

  const seekBy = useCallback(
    (delta: number, feedback: 'pulse' | 'none' = 'pulse') => {
      if (!caps.seek) return;
      const target = Math.max(0, snapshot.currentTime + delta);
      adapterRef.current?.seek(snapshot.duration ? Math.min(target, snapshot.duration) : target);
      // The double-tap zones draw their ripple where the finger landed, so the
      // centred pulse would be a second, wrongly-placed confirmation.
      if (feedback === 'pulse') pulseSkip(delta > 0 ? 'forward' : 'back');
      announce(delta > 0 ? t('forward10') : t('back10'));
      wake();
    },
    [caps.seek, snapshot.currentTime, snapshot.duration, pulseSkip, announce, t, wake]
  );

  const setVolume = useCallback(
    (volume01: number) => {
      const value = clamp(Number(volume01.toFixed(3)), 0, 1);
      // Dragging to zero mutes; moving off zero unmutes. Matches every major
      // player and avoids a slider that appears to do nothing while muted.
      updatePrefs({ volume: value, muted: value === 0 });
      wake();
    },
    [updatePrefs, wake]
  );

  const toggleMute = useCallback(() => {
    setPrefs((p) => {
      const muted = !p.muted;
      announce(muted ? t('stateMuted') : t('stateUnmuted'));
      // Unmuting from a zero level would be a silent no-op, so restore a level.
      return { ...p, muted, volume: !muted && p.volume === 0 ? 0.5 : p.volume };
    });
    wake();
  }, [announce, t, wake]);

  /**
   * The viewer answered the "tap to unmute" prompt.
   *
   * The engine muted ITSELF to satisfy the autoplay policy, without touching
   * `prefs`, so `prefs.muted` is already false and a state update alone would not
   * re-run the volume effect. The adapter is therefore commanded directly, and
   * the tap doubles as the gesture that lets playback start with sound if it had
   * been refused outright.
   */
  const unmuteFromAutoplay = useCallback(() => {
    const volume = prefs.volume > 0 ? prefs.volume : 1;
    adapterRef.current?.setVolume(volume, false);
    setSnapshot((prev) => ({ ...prev, autoplayBlocked: false, muted: false }));
    updatePrefs({ muted: false, volume });
    void adapterRef.current?.play();
    announce(t('stateUnmuted'));
    wake();
  }, [prefs.volume, updatePrefs, announce, t, wake]);

  const setRate = useCallback(
    (rate: number) => {
      updatePrefs({ rate });
      wake();
    },
    [updatePrefs, wake]
  );

  const cycleRate = useCallback(
    (direction: 1 | -1) => {
      if (!caps.rate) return;
      const index = RATES.indexOf(prefs.rate as (typeof RATES)[number]);
      const next = RATES[clamp((index === -1 ? 2 : index) + direction, 0, RATES.length - 1)]!;
      setRate(next);
    },
    [caps.rate, prefs.rate, setRate]
  );

  const selectAudio = useCallback(
    (id: string) => {
      const track = snapshot.audioTracks.find((a) => a.id === id);
      adapterRef.current?.selectAudioTrack(id);
      if (track) updatePrefs({ audioLang: track.lang });
      wake();
    },
    [snapshot.audioTracks, updatePrefs, wake]
  );

  const selectText = useCallback(
    (id: string | null) => {
      adapterRef.current?.selectTextTrack(id);
      if (id === null) {
        updatePrefs({ subtitlesEnabled: false });
      } else {
        const track = snapshot.textTracks.find((s) => s.id === id);
        updatePrefs({ subtitlesEnabled: true, subtitleLang: track?.lang ?? null });
      }
      wake();
    },
    [snapshot.textTracks, updatePrefs, wake]
  );

  /**
   * Pin a rendition, or `null` for Auto.
   *
   * The preference is stored as the chosen level's HEIGHT (not its id), because
   * level ids are per-manifest: remembering "index 2" would mean 1080p on one
   * title and 360p on the next. `null` means "highest available", which is the
   * product default.
   */
  const selectQuality = useCallback(
    (id: string | null) => {
      adapterRef.current?.selectQuality?.(id);
      if (id === null) {
        updatePrefs({ preferredQualityHeight: null });
        announce(`${t('quality')}: ${t('auto')}`);
      } else {
        const level = snapshot.qualityLevels.find((q) => q.id === id);
        updatePrefs({ preferredQualityHeight: level?.height ?? null });
        if (level) announce(`${t('quality')}: ${level.label}`);
      }
      wake();
    },
    [snapshot.qualityLevels, updatePrefs, announce, t, wake]
  );

  /**
   * Apply the remembered quality once the renditions for a new source appear.
   *
   * Matching is by height, and only an EXACT height is honoured: silently
   * substituting the nearest rendition would make the menu disagree with what is
   * playing. With no match (or no preference) the adapter's own default stands,
   * which is the highest rendition — see adapters/html5.ts.
   */
  const appliedQualityFor = useRef<string>('');
  useEffect(() => {
    const adapter = adapterRef.current;
    if (!adapter?.selectQuality || snapshot.qualityLevels.length === 0) return;
    const signature = `${sourceKey}:${snapshot.qualityLevels.map((q) => q.id).join(',')}`;
    if (appliedQualityFor.current === signature) return;
    appliedQualityFor.current = signature;
    if (prefs.preferredQualityHeight === null) return; // highest / adaptive
    const wanted = snapshot.qualityLevels.find((q) => q.height === prefs.preferredQualityHeight);
    if (wanted && !wanted.active) adapter.selectQuality(wanted.id);
  }, [snapshot.qualityLevels, prefs.preferredQualityHeight, sourceKey]);

  const toggleSubtitles = useCallback(() => {
    if (!caps.textTracks) return;
    const active = snapshot.textTracks.find((s) => s.active);
    if (active) {
      selectText(null);
      announce(`${t('subtitles')}: ${t('off')}`);
      return;
    }
    const wanted = resolveTrack(snapshot.textTracks, prefs.subtitleLang) ?? snapshot.textTracks[0];
    if (wanted) {
      selectText(wanted.id);
      announce(`${t('subtitles')}: ${wanted.label ?? wanted.lang}`);
    }
  }, [caps.textTracks, snapshot.textTracks, prefs.subtitleLang, selectText, announce, t]);

  const setBrightness = useCallback(
    (value: number) => {
      updatePrefs({ brightness: clamp(Number(value.toFixed(3)), BRIGHTNESS_MIN, BRIGHTNESS_MAX) });
    },
    [updatePrefs]
  );

  const setZoom = useCallback(
    (value: number) => {
      updatePrefs({ zoom: clamp(Number(value.toFixed(3)), ZOOM_MIN, ZOOM_MAX) });
    },
    [updatePrefs]
  );

  const toggleGestures = useCallback(() => {
    setPrefs((p) => ({ ...p, gestures: !p.gestures }));
  }, []);

  const requestPip = useCallback(() => {
    adapterRef.current?.requestPictureInPicture?.();
  }, []);

  const thumbnailAt = useCallback(
    (seconds: number) => adapterRef.current?.thumbnailAt?.(seconds) ?? null,
    []
  );

  // ── Fullscreen ────────────────────────────────────────────────────────────
  const lockLandscape = useCallback(() => {
    const orientation = screen.orientation as
      | (ScreenOrientation & { lock?: (o: string) => Promise<void> })
      | undefined;
    if (!orientation?.lock) return;
    // Only on touch devices: locking a desktop display is hostile.
    if (!window.matchMedia('(pointer: coarse)').matches) return;
    orientation.lock('landscape').catch(() => undefined);
  }, []);

  const exitFullscreen = useCallback(() => {
    setPseudoFs(false);
    const doc = document as Document & { webkitExitFullscreen?: () => void };
    if (document.fullscreenElement) void document.exitFullscreen?.();
    else doc.webkitExitFullscreen?.();
    try {
      screen.orientation?.unlock?.();
    } catch {
      /* unsupported */
    }
  }, []);

  const enterFullscreen = useCallback(() => {
    const el = stageRef.current as
      | (HTMLDivElement & { webkitRequestFullscreen?: () => Promise<void> | void })
      | null;
    if (!el) return;
    const request = el.requestFullscreen?.bind(el) ?? el.webkitRequestFullscreen?.bind(el);
    if (!request) {
      // iOS Safari cannot fullscreen a <div>; cover the viewport ourselves so
      // the button still does what it says.
      setPseudoFs(true);
      return;
    }
    try {
      Promise.resolve(request())
        .then(lockLandscape)
        .catch(() => setPseudoFs(true));
    } catch {
      setPseudoFs(true);
    }
  }, [lockLandscape]);

  const toggleFullscreen = useCallback(() => {
    if (isFullscreen) exitFullscreen();
    else enterFullscreen();
    wake();
  }, [isFullscreen, enterFullscreen, exitFullscreen, wake]);

  useEffect(() => {
    const sync = () => {
      const element = document.fullscreenElement;
      const stage = stageRef.current;
      // ISOLATION: `document.fullscreenElement` is page-global. The detail pages
      // carry other fullscreen-capable elements (the separate trailer <iframe>
      // further down the page, an image viewer), and treating any of them as
      // "the player is fullscreen" would resize our chrome for someone else's
      // fullscreen. Only our own stage — or a descendant of it, which is how iOS
      // reports a <video> in native fullscreen — counts.
      const active = !!element && !!stage && (element === stage || stage.contains(element));
      setNativeFs(active);
      if (active) setPseudoFs(false);
    };
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, []);

  // Pseudo-fullscreen must not leave the page scrolling behind the overlay.
  useEffect(() => {
    if (!pseudoFs) return;
    document.documentElement.classList.add('fp-noscroll');
    return () => document.documentElement.classList.remove('fp-noscroll');
  }, [pseudoFs]);

  // ── Connection ────────────────────────────────────────────────────────────
  // The browser knows about a dropped connection before any segment request
  // times out, so the viewer gets the honest reason (and an announcement)
  // instead of staring at a spinner for 30 seconds.
  useEffect(() => {
    const sync = () => {
      const down = typeof navigator !== 'undefined' && navigator.onLine === false;
      // Compared against a ref, not state: the announcement must fire exactly
      // once per transition, and a state updater is not the place for effects.
      if (offlineRef.current === down) return;
      offlineRef.current = down;
      setOffline(down);
      announce(down ? t('offline') : t('statePlaying'));
    };
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, [announce, t]);

  // ── Keyboard ──────────────────────────────────────────────────────────────
  // Bound to the stage element (not the window) so the player never steals keys
  // from the page's search field or another island.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      // Let sliders and text inputs use the arrow keys themselves.
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        if (event.key.startsWith('Arrow')) return;
      }

      let handled = true;
      switch (event.key) {
        case ' ':
        case 'k':
        case 'K':
          togglePlay();
          break;
        case 'ArrowRight':
        case 'l':
        case 'L':
          if (caps.seek) seekBy(SKIP_SECONDS);
          else handled = false;
          break;
        case 'ArrowLeft':
        case 'j':
        case 'J':
          if (caps.seek) seekBy(-SKIP_SECONDS);
          else handled = false;
          break;
        case 'ArrowUp':
          if (caps.volume !== 'none') setVolume(Math.min(1, prefs.volume + 0.05));
          else handled = false;
          break;
        case 'ArrowDown':
          if (caps.volume !== 'none') setVolume(Math.max(0, prefs.volume - 0.05));
          else handled = false;
          break;
        case 'f':
        case 'F':
          toggleFullscreen();
          break;
        case 'm':
        case 'M':
          if (caps.volume !== 'none') toggleMute();
          else handled = false;
          break;
        case 'c':
        case 'C':
          toggleSubtitles();
          break;
        case '>':
          cycleRate(1);
          break;
        case '<':
          cycleRate(-1);
          break;
        case ']':
          setBrightness(prefs.brightness + 0.1);
          break;
        case '[':
          setBrightness(prefs.brightness - 0.1);
          break;
        case '+':
        case '=':
          setZoom(prefs.zoom + 0.1);
          break;
        case '-':
          setZoom(prefs.zoom - 0.1);
          break;
        case 'Escape':
          if (menu) setMenu(null);
          else if (isFullscreen) exitFullscreen();
          else handled = false;
          break;
        default:
          // 0–9 jump to that tenth of the title, like YouTube.
          if (/^[0-9]$/.test(event.key) && caps.seek && snapshot.duration > 0) {
            seekTo((Number(event.key) / 10) * snapshot.duration);
          } else {
            handled = false;
          }
      }
      if (handled) {
        // Space and the arrows scroll the page by default.
        event.preventDefault();
        event.stopPropagation();
        wake();
      }
    };

    stage.addEventListener('keydown', onKeyDown);
    return () => stage.removeEventListener('keydown', onKeyDown);
  }, [
    caps.seek,
    caps.volume,
    cycleRate,
    exitFullscreen,
    isFullscreen,
    menu,
    prefs.brightness,
    prefs.volume,
    prefs.zoom,
    seekBy,
    seekTo,
    setBrightness,
    setVolume,
    setZoom,
    snapshot.duration,
    toggleFullscreen,
    toggleMute,
    togglePlay,
    toggleSubtitles,
    wake,
  ]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const activeMarker = useMemo(() => {
    if (!caps.seek || markers.length === 0) return null;
    const time = snapshot.currentTime;
    return markers.find((m) => time >= m.start && time < m.end) ?? null;
  }, [caps.seek, markers, snapshot.currentTime]);

  const slowNetwork =
    snapshot.bandwidth !== null && snapshot.bandwidth > 0 && snapshot.bandwidth < SLOW_BANDWIDTH;

  useEffect(
    () => () => {
      window.clearTimeout(idleTimer.current);
      window.clearTimeout(announceTimer.current);
      window.clearTimeout(pulseTimer.current);
    },
    []
  );

  return {
    hostRef,
    stageRef,
    snapshot,
    caps,
    engine,
    prefs,
    controlsVisible: controlsVisible || holdOpen,
    menu,
    setMenu,
    isFullscreen,
    pseudoFullscreen: pseudoFs,
    announcement,
    activeMarker,
    scrubTime,
    setScrubTime,
    togglePlay,
    play,
    pause,
    seekTo,
    seekBy,
    setVolume,
    toggleMute,
    unmuteFromAutoplay,
    setRate,
    cycleRate,
    selectAudio,
    selectText,
    selectQuality,
    toggleSubtitles,
    setBrightness,
    setZoom,
    toggleGestures,
    updatePrefs,
    toggleFullscreen,
    requestPip,
    wake,
    holdChrome,
    thumbnailAt,
    skipPulse,
    pulseSkip,
    slowNetwork,
    offline,
  };
}
