// src/components/react/player/PlayerShell.tsx — the stage and its chrome.
//
// RESPONSIBILITIES
// Renders the engine host, every overlay (splash, spinner, error, cues, HUD,
// skip pulse, gesture zones, up-next, end card) and the control bar. It holds no
// playback state of its own: everything comes from `usePlayer`.
//
// RESPONSIVE REFLOW (not shrink)
// The bar measures its own width with a ResizeObserver and switches between three
// layouts at breakpoints read from CSS custom properties (`--fp-bp-compact`,
// `--fp-bp-wide` — see styles/player.css, no magic numbers here):
//   compact  (<40rem) primary transport only; everything secondary moves into the
//                     overflow sheet, targets grow to 44px, the title truncates.
//   regular  (<64rem) transport + volume + tracks + fullscreen inline.
//   wide     (≥64rem) adds speed, PiP, episode nav labels and the time readout.
// Measuring the *stage* rather than the viewport is deliberate: the same shell is
// used inline in a page column and in fullscreen, and only its own width matters.
//
// POINTER SURFACES
// • Engines we control (html5 / youtube): the whole surface is a tap target —
//   tap toggles the controls, double-tap on a side skips ±10s.
// • The third-party embed engine: only two narrow edge strips are interactive, so
//   the provider's own play/pause and seek bar stay clickable. This is why the
//   zones are not simply "left half / right half" for every engine.

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { PlayerApi } from './usePlayer';
import { SKIP_SECONDS } from './usePlayer';
import type { TimeMarker } from '../../../lib/player/types';
import { formatTime } from '../../../lib/player/format';
import type { PlayerT } from '../../../lib/player/strings';
import { BRIGHTNESS_MAX, BRIGHTNESS_MIN } from '../../../lib/player/prefs';
import SeekBar from './SeekBar';
import VolumeControl from './VolumeControl';
import Popover from './Popover';
import TracksMenu from './TracksMenu';
import SpeedMenu from './SpeedMenu';
import OverflowMenu from './OverflowMenu';
import SubtitleLayer from './SubtitleLayer';
import {
  AudioTrackIcon,
  BackIcon,
  BrightnessIcon,
  CaptionsIcon,
  EpisodesIcon,
  ExitFullscreenIcon,
  FullscreenIcon,
  MoreIcon,
  NextIcon,
  PauseIcon,
  PipIcon,
  PlayIcon,
  PrevIcon,
  ReplayIcon,
  SkipIcon,
  SpeedIcon,
  VolumeIcon,
  WarningIcon,
  ZoomInIcon,
} from './Icons';

type Layout = 'compact' | 'regular' | 'wide';

export interface PlayerShellProps {
  api: PlayerApi;
  t: PlayerT;
  title: string;
  /** Secondary line, e.g. "S2 · E4 · Episode name". */
  subtitle?: string | null;
  /** Backdrop for the pre-play splash. */
  splashImage?: string | null;
  /** False until the viewer has pressed Play (or resumed). */
  started: boolean;
  onStart: () => void;
  onBack?: () => void;
  onReload: () => void;
  markers: TimeMarker[];
  /** Server / source switcher, rendered under the stage. */
  belowStage?: ReactNode;
  /** Episode navigation (series only). */
  episodeNav?: {
    hasPrev: boolean;
    hasNext: boolean;
    onPrev: () => void;
    onNext: () => void;
    onOpenEpisodes: () => void;
  } | null;
  /** Panel rendered when the Episodes menu is open. */
  episodesPanel?: ReactNode;
  /** Up-next prompt (series, near/after the end). */
  upNext?: ReactNode;
  /** End card (video finished). */
  endCard?: ReactNode;
  /** Extra note under the stage (e.g. the volume-relay explanation). */
  notice?: ReactNode;
  /** Autoplay-next preference plumbing for the overflow sheet. */
  showAutoplayNext: boolean;
}

/** Read a rem-valued CSS custom property from an element, in pixels. */
function readRemToken(element: Element, name: string, fallbackPx: number): number {
  const raw = getComputedStyle(element).getPropertyValue(name).trim();
  if (!raw) return fallbackPx;
  const rootSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  if (raw.endsWith('rem')) return parseFloat(raw) * rootSize;
  if (raw.endsWith('px')) return parseFloat(raw);
  const numeric = parseFloat(raw);
  return Number.isFinite(numeric) ? numeric : fallbackPx;
}

export default function PlayerShell({
  api,
  t,
  title,
  subtitle,
  splashImage,
  started,
  onStart,
  onBack,
  onReload,
  markers,
  belowStage,
  episodeNav,
  episodesPanel,
  upNext,
  endCard,
  notice,
  showAutoplayNext,
}: PlayerShellProps) {
  const {
    hostRef,
    stageRef,
    snapshot,
    caps,
    engine,
    prefs,
    controlsVisible,
    menu,
    setMenu,
    isFullscreen,
    pseudoFullscreen,
    announcement,
    activeMarker,
    scrubTime,
    setScrubTime,
    togglePlay,
    seekTo,
    seekBy,
    setVolume,
    toggleMute,
    setRate,
    selectAudio,
    selectText,
    toggleSubtitles,
    setBrightness,
    setZoom,
    toggleGestures,
    updatePrefs,
    toggleFullscreen,
    requestPip,
    wake,
    thumbnailAt,
    skipPulse,
    slowNetwork,
    offline,
  } = api;

  const tracksBtn = useRef<HTMLButtonElement>(null);
  const speedBtn = useRef<HTMLButtonElement>(null);
  const overflowBtn = useRef<HTMLButtonElement>(null);
  const episodesBtn = useRef<HTMLButtonElement>(null);

  // ── Layout measurement ────────────────────────────────────────────────────
  const [layout, setLayout] = useState<Layout>('regular');
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === 'undefined') return;
    const compactAt = readRemToken(stage, '--fp-bp-compact', 640);
    const wideAt = readRemToken(stage, '--fp-bp-wide', 1024);
    const measure = (width: number) => {
      setLayout(width < compactAt ? 'compact' : width < wideAt ? 'regular' : 'wide');
    };
    measure(stage.clientWidth);
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) measure(width);
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, [stageRef]);

  const compact = layout === 'compact';
  const wide = layout === 'wide';

  // ── HUD (brightness / volume / zoom flash) ────────────────────────────────
  const [hud, setHud] = useState<{ kind: 'brightness' | 'volume' | 'zoom'; value: number } | null>(
    null
  );
  const hudTimer = useRef<number | undefined>(undefined);
  const flashHud = useCallback((kind: 'brightness' | 'volume' | 'zoom', value: number) => {
    setHud({ kind, value });
    window.clearTimeout(hudTimer.current);
    hudTimer.current = window.setTimeout(() => setHud(null), 900);
  }, []);
  useEffect(() => () => window.clearTimeout(hudTimer.current), []);

  // ── Gesture zones ─────────────────────────────────────────────────────────
  // Vertical drag: brightness on the left, volume on the right (the phone-player
  // convention). A tap that never moved is treated as a tap, not a nudge.
  const drag = useRef<{
    kind: 'brightness' | 'volume';
    startY: number;
    startValue: number;
    moved: boolean;
    pointerId: number;
  } | null>(null);
  const lastTap = useRef<{ time: number; side: 'left' | 'right' } | null>(null);

  const onZoneDown = useCallback(
    (kind: 'brightness' | 'volume') => (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      drag.current = {
        kind,
        startY: event.clientY,
        startValue: kind === 'brightness' ? prefs.brightness : prefs.volume,
        moved: false,
        pointerId: event.pointerId,
      };
      wake();
    },
    [prefs.brightness, prefs.volume, wake]
  );

  const onZoneMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const session = drag.current;
      const stage = stageRef.current;
      if (!session || !stage || session.pointerId !== event.pointerId) return;
      const height = stage.clientHeight || 1;
      const delta = session.startY - event.clientY;
      if (Math.abs(delta) > 6) session.moved = true;
      // 65% of the stage height spans the full range — enough travel for fine
      // control without needing to swipe past the edge.
      const ratio = delta / (height * 0.65);
      if (session.kind === 'brightness') {
        const next = session.startValue + ratio * (BRIGHTNESS_MAX - BRIGHTNESS_MIN);
        setBrightness(next);
        flashHud('brightness', Math.round((Math.min(Math.max(next, BRIGHTNESS_MIN), BRIGHTNESS_MAX) / BRIGHTNESS_MAX) * 100));
      } else {
        const next = Math.min(1, Math.max(0, session.startValue + ratio));
        setVolume(next);
        flashHud('volume', Math.round(next * 100));
      }
      event.preventDefault();
    },
    [flashHud, setBrightness, setVolume, stageRef]
  );

  const onZoneUp = useCallback(
    (side: 'left' | 'right') => (event: React.PointerEvent<HTMLDivElement>) => {
      const session = drag.current;
      drag.current = null;
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      if (!session || session.moved) return;

      // Double-tap a side to skip, single tap just reveals the controls.
      const now = Date.now();
      const previous = lastTap.current;
      if (previous && previous.side === side && now - previous.time < 320 && caps.seek) {
        lastTap.current = null;
        seekBy(side === 'left' ? -SKIP_SECONDS : SKIP_SECONDS);
        return;
      }
      lastTap.current = { time: now, side };
      wake();
    },
    [caps.seek, seekBy, wake]
  );

  // ── Derived UI state ──────────────────────────────────────────────────────
  const isPlaying = snapshot.status === 'playing';
  const isBuffering = snapshot.status === 'buffering' || (started && snapshot.status === 'loading');
  const hasError = snapshot.status === 'error' && !!snapshot.error;
  const ended = snapshot.status === 'ended';
  const showSeekBar = caps.time && snapshot.duration > 0;
  const activeTextTrack = snapshot.textTracks.find((s) => s.active) ?? null;

  const errorMessage = useMemo(() => {
    const kind = snapshot.error?.kind;
    // A dropped connection is the real cause; saying "network error" when the
    // device is plainly offline sends the viewer looking for the wrong fix.
    if (offline && (kind === 'network' || kind === 'unknown' || !kind)) return t('offline');
    switch (kind) {
      case 'network':
        return t('errNetwork');
      case 'unsupported':
        return t('errUnsupported');
      case 'decode':
        return t('errDecode');
      case 'drm':
        return t('errDrm');
      case 'geo':
        return t('errGeo');
      case 'notfound':
        return t('errNotFound');
      default:
        return t('errUnknown');
    }
  }, [snapshot.error?.kind, offline, t]);

  const surfaceStyle = useMemo(
    () => ({
      filter: `brightness(${prefs.brightness})`,
      transform: `scale(${prefs.zoom})`,
    }),
    [prefs.brightness, prefs.zoom]
  );

  const stageClass = [
    'fp-stage',
    isFullscreen ? 'is-fullscreen' : '',
    // The CSS fallback needs its own class: `is-fullscreen` only resizes, while
    // this one has to position the stage fixed over the whole page (iOS Safari,
    // which refuses to fullscreen anything but a <video>).
    pseudoFullscreen ? 'is-pseudo-fullscreen' : '',
    controlsVisible ? 'is-controls-visible' : 'is-controls-hidden',
    started ? 'is-started' : 'is-idle',
    compact ? 'is-compact' : '',
    wide ? 'is-wide' : '',
    engine ? `is-engine-${engine}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  // The primary transport button reflects the real state, including "replay"
  // once the video has ended — a play icon there would be a lie.
  const primaryLabel = ended ? t('replay') : isPlaying ? t('pause') : t('play');

  return (
    <div className="fp-root">
      <div
        ref={stageRef}
        className={stageClass}
        tabIndex={0}
        role="group"
        aria-label={`${title} — ${t('play')}`}
        onMouseMove={wake}
        onPointerDown={wake}
      >
        {/* Engine surface. The adapter appends <video> / <iframe> here. */}
        <div ref={hostRef} className="fp-surface" style={surfaceStyle} />

        {/* Pre-play splash. A button, so Enter/Space start playback and the
            whole poster is one large touch target. */}
        {!started && !hasError && (
          <button
            type="button"
            className="fp-splash"
            onClick={onStart}
            style={splashImage ? { backgroundImage: `url(${splashImage})` } : undefined}
            aria-label={`${t('play')} ${title}`}
          >
            <span className="fp-splash-scrim" aria-hidden="true" />
            <span className="fp-splash-play" aria-hidden="true">
              <PlayIcon size={30} />
            </span>
            <span className="fp-splash-text">
              <span className="fp-splash-title">{title}</span>
              {subtitle && <span className="fp-splash-sub">{subtitle}</span>}
            </span>
          </button>
        )}

        {/* Gesture zones only where WE own playback (html5 / youtube). On the
            third-party embed engine we cannot drive the video anyway, so any
            overlay would just sit on top of the provider's OWN controls and
            block them — the exact "cannot control the server" problem. Render
            nothing there, so every provider control (play/pause, seek, quality,
            audio track, fullscreen) inside the frame is fully reachable. */}
        {started && prefs.gestures && !hasError && !ended && engine !== 'embed' && (
          <>
            <div
              className="fp-zone fp-zone-left"
              onPointerDown={onZoneDown('brightness')}
              onPointerMove={onZoneMove}
              onPointerUp={onZoneUp('left')}
              onPointerCancel={onZoneUp('left')}
              onDoubleClick={() => setBrightness(1)}
              aria-hidden="true"
            />
            <div
              className="fp-zone fp-zone-right"
              onPointerDown={onZoneDown('volume')}
              onPointerMove={onZoneMove}
              onPointerUp={onZoneUp('right')}
              onPointerCancel={onZoneUp('right')}
              onDoubleClick={toggleMute}
              aria-hidden="true"
            />
            {/* Centre tap: only where we can actually toggle playback. */}
            {caps.playback && (
              <div
                className="fp-zone fp-zone-centre"
                onClick={togglePlay}
                aria-hidden="true"
              />
            )}
          </>
        )}

        {/* Skip feedback pulse (double-tap / ± keys). */}
        {skipPulse && (
          <div className={`fp-skip-pulse is-${skipPulse}`} aria-hidden="true">
            <SkipIcon size={30} direction={skipPulse} />
            <span>{SKIP_SECONDS}s</span>
          </div>
        )}

        {/* Buffering. A quiet ring, not a jarring spinner, and only after the
            engine has been stalled long enough to be worth mentioning. */}
        {isBuffering && !hasError && (
          <div className="fp-spinner" role="status" aria-label={t('buffering')}>
            <span className="fp-spinner-ring" aria-hidden="true" />
          </div>
        )}

        {/* Adaptive-bitrate degradation notice. */}
        {slowNetwork && isPlaying && !offline && (
          <p className="fp-slow" role="status">
            {t('slowNetwork')}
          </p>
        )}

        {/* Offline banner. Shown whenever the connection is down and the error
            card is not already saying it — playback can survive on the buffer
            for a while, so this is a warning, not a failure. */}
        {offline && !hasError && (
          <p className="fp-slow is-offline" role="status">
            {t('offline')}
          </p>
        )}

        {/* Error card with the recovery that fits the failure. */}
        {hasError && (
          <div className="fp-error" role="alert">
            <span className="fp-error-icon" aria-hidden="true">
              <WarningIcon size={26} />
            </span>
            <p className="fp-error-text">{errorMessage}</p>
            <div className="fp-error-actions">
              {snapshot.error?.retryable !== false && (
                <button type="button" className="fp-pill fp-pill-primary" onClick={onReload}>
                  {t('retry')}
                </button>
              )}
              {onBack && (
                <button type="button" className="fp-pill" onClick={onBack}>
                  {t('back')}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Subtitles we render ourselves (html5 only). */}
        <SubtitleLayer
          cues={snapshot.cues}
          size={prefs.subtitleSize}
          backdrop={prefs.subtitleBackdrop}
          lifted={controlsVisible}
        />

        {/* Gesture HUD. */}
        {hud && (
          <div className="fp-hud" aria-hidden="true">
            <span className="fp-hud-icon">
              {hud.kind === 'brightness' ? (
                <BrightnessIcon size={18} />
              ) : hud.kind === 'volume' ? (
                <VolumeIcon size={18} level={hud.value / 100} />
              ) : (
                <ZoomInIcon size={18} />
              )}
            </span>
            <span className="fp-hud-bar">
              <span className="fp-hud-fill" style={{ width: `${hud.value}%` }} />
            </span>
            <span className="fp-hud-value">{hud.value}%</span>
          </div>
        )}

        {/* Top bar: back + title. Hidden with the controls. */}
        {started && (
          <div className="fp-topbar">
            {onBack && (
              <button
                type="button"
                className="fp-btn fp-btn-ghost"
                onClick={onBack}
                aria-label={t('back')}
                title={t('back')}
              >
                <BackIcon size={20} />
              </button>
            )}
            <span className="fp-topbar-text">
              <span className="fp-topbar-title">{title}</span>
              {subtitle && <span className="fp-topbar-sub">{subtitle}</span>}
            </span>
          </div>
        )}

        {/* Skip Intro / Recap / Credits — appears only while the playhead is
            inside a marker, and disappears on its own. */}
        {activeMarker && started && !ended && (
          <button
            type="button"
            className="fp-skip-marker"
            onClick={() => seekTo(activeMarker.end)}
          >
            {activeMarker.kind === 'intro'
              ? t('skipIntro')
              : activeMarker.kind === 'recap'
                ? t('skipRecap')
                : t('skipCredits')}
          </button>
        )}

        {upNext}
        {ended && endCard}

        {/* ── Control bar ── */}
        {started && !hasError && (
          <div
            className="fp-controls"
            // Pointer events here must not reach the tap-to-toggle zones.
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            onMouseEnter={wake}
          >
            {showSeekBar && (
              <SeekBar
                currentTime={snapshot.currentTime}
                duration={snapshot.duration}
                buffered={snapshot.buffered}
                seekable={caps.seek}
                markers={markers}
                scrubTime={scrubTime}
                onScrub={setScrubTime}
                onCommit={seekTo}
                onNudge={seekBy}
                thumbnailAt={thumbnailAt}
                t={t}
              />
            )}

            <div className="fp-bar">
              <div className="fp-bar-group fp-bar-start">
                {caps.playback && (
                  <button
                    type="button"
                    className="fp-btn fp-btn-primary"
                    onClick={togglePlay}
                    aria-label={primaryLabel}
                    title={`${primaryLabel} (Space)`}
                  >
                    {ended ? <ReplayIcon /> : isPlaying ? <PauseIcon /> : <PlayIcon />}
                  </button>
                )}

                {caps.seek && (
                  <>
                    <button
                      type="button"
                      className="fp-btn"
                      onClick={() => seekBy(-SKIP_SECONDS)}
                      aria-label={t('back10')}
                      title={`${t('back10')} (←)`}
                    >
                      <SkipIcon direction="back" />
                    </button>
                    <button
                      type="button"
                      className="fp-btn"
                      onClick={() => seekBy(SKIP_SECONDS)}
                      aria-label={t('forward10')}
                      title={`${t('forward10')} (→)`}
                    >
                      <SkipIcon direction="forward" />
                    </button>
                  </>
                )}

                {episodeNav && !compact && (
                  <>
                    <button
                      type="button"
                      className="fp-btn"
                      onClick={episodeNav.onPrev}
                      disabled={!episodeNav.hasPrev}
                      aria-label={t('prevEpisode')}
                      title={t('prevEpisode')}
                    >
                      <PrevIcon />
                    </button>
                    <button
                      type="button"
                      className="fp-btn"
                      onClick={episodeNav.onNext}
                      disabled={!episodeNav.hasNext}
                      aria-label={t('nextEpisode')}
                      title={t('nextEpisode')}
                    >
                      <NextIcon />
                    </button>
                  </>
                )}

                {caps.volume !== 'none' && (
                  <VolumeControl
                    volume={prefs.volume}
                    muted={prefs.muted}
                    mode={caps.volume}
                    onVolume={(value) => {
                      setVolume(value);
                      flashHud('volume', Math.round(value * 100));
                    }}
                    onToggleMute={toggleMute}
                    t={t}
                  />
                )}

                {/* Time readout: only where time is real, and only when there is
                    room — on compact it lives under the seek bar instead. */}
                {showSeekBar && (
                  <span className="fp-time" aria-hidden="true">
                    <span className="fp-time-current">{formatTime(scrubTime ?? snapshot.currentTime)}</span>
                    <span className="fp-time-sep">/</span>
                    <span className="fp-time-total">{formatTime(snapshot.duration)}</span>
                  </span>
                )}
              </div>

              <div className="fp-bar-group fp-bar-end">
                {/* Captions quick-toggle: the single most used control after
                    play, so it stays in the bar at every size. */}
                {caps.textTracks && (
                  <button
                    type="button"
                    className={`fp-btn${activeTextTrack ? ' is-on' : ''}`}
                    onClick={toggleSubtitles}
                    aria-label={t('subtitles')}
                    aria-pressed={!!activeTextTrack}
                    title={`${t('subtitles')} (C)`}
                  >
                    <CaptionsIcon active={!!activeTextTrack} />
                  </button>
                )}

                {/* Audio & subtitles panel. Always available: on the embed engine
                    it explains where the tracks are instead of listing them. */}
                <button
                  ref={tracksBtn}
                  type="button"
                  className={`fp-btn${menu === 'tracks' ? ' is-open' : ''}`}
                  onClick={() => setMenu(menu === 'tracks' ? null : 'tracks')}
                  aria-label={t('audioAndSubtitles')}
                  aria-haspopup="dialog"
                  aria-expanded={menu === 'tracks'}
                  title={t('audioAndSubtitles')}
                >
                  <AudioTrackIcon />
                </button>

                {caps.rate && !compact && (
                  <button
                    ref={speedBtn}
                    type="button"
                    className={`fp-btn${menu === 'speed' ? ' is-open' : ''}${prefs.rate !== 1 ? ' is-on' : ''}`}
                    onClick={() => setMenu(menu === 'speed' ? null : 'speed')}
                    aria-label={t('speed')}
                    aria-haspopup="dialog"
                    aria-expanded={menu === 'speed'}
                    title={t('speed')}
                  >
                    <SpeedIcon />
                    {prefs.rate !== 1 && <span className="fp-btn-badge">{prefs.rate}×</span>}
                  </button>
                )}

                {episodeNav && (
                  <button
                    ref={episodesBtn}
                    type="button"
                    className={`fp-btn${menu === 'episodes' ? ' is-open' : ''}`}
                    onClick={() => {
                      episodeNav.onOpenEpisodes();
                      setMenu(menu === 'episodes' ? null : 'episodes');
                    }}
                    aria-label={t('episodes')}
                    aria-haspopup="dialog"
                    aria-expanded={menu === 'episodes'}
                    title={t('episodes')}
                  >
                    <EpisodesIcon />
                  </button>
                )}

                {caps.pip && wide && (
                  <button
                    type="button"
                    className="fp-btn"
                    onClick={requestPip}
                    aria-label={t('pip')}
                    title={t('pip')}
                  >
                    <PipIcon />
                  </button>
                )}

                {/* Overflow: the reflow target for everything the current width
                    cannot hold. */}
                <button
                  ref={overflowBtn}
                  type="button"
                  className={`fp-btn${menu === 'overflow' ? ' is-open' : ''}`}
                  onClick={() => setMenu(menu === 'overflow' ? null : 'overflow')}
                  aria-label={t('more')}
                  aria-haspopup="dialog"
                  aria-expanded={menu === 'overflow'}
                  title={t('more')}
                >
                  <MoreIcon />
                </button>

                <button
                  type="button"
                  className="fp-btn"
                  onClick={toggleFullscreen}
                  aria-label={isFullscreen ? t('exitFullscreen') : t('fullscreen')}
                  title={`${isFullscreen ? t('exitFullscreen') : t('fullscreen')} (F)`}
                >
                  {isFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
                </button>
              </div>
            </div>

            {/* Menus are children of the control bar so they inherit its
                stacking context and stay visible in fullscreen. */}
            <Popover
              open={menu === 'tracks'}
              onClose={() => setMenu(null)}
              label={t('audioAndSubtitles')}
              triggerRef={tracksBtn}
              className="fp-menu-end"
            >
              <TracksMenu
                audioTracks={snapshot.audioTracks}
                textTracks={snapshot.textTracks}
                canSelectAudio={caps.audioTracks}
                canSelectText={caps.textTracks}
                canStyleSubtitles={caps.subtitleStyling}
                managedExternally={engine === 'embed'}
                subtitleSize={prefs.subtitleSize}
                subtitleBackdrop={prefs.subtitleBackdrop}
                onSelectAudio={selectAudio}
                onSelectText={selectText}
                onSubtitleSize={(size) => updatePrefs({ subtitleSize: size })}
                onSubtitleBackdrop={(backdrop) => updatePrefs({ subtitleBackdrop: backdrop })}
                t={t}
              />
            </Popover>

            <Popover
              open={menu === 'speed'}
              onClose={() => setMenu(null)}
              label={t('speed')}
              triggerRef={speedBtn}
              className="fp-menu-end"
            >
              <SpeedMenu rate={prefs.rate} onSelect={setRate} t={t} />
            </Popover>

            <Popover
              open={menu === 'overflow'}
              onClose={() => setMenu(null)}
              label={t('settings')}
              triggerRef={overflowBtn}
              className="fp-menu-end"
            >
              <OverflowMenu
                brightness={prefs.brightness}
                zoom={prefs.zoom}
                gestures={prefs.gestures}
                autoplayNext={prefs.autoplayNext}
                showAutoplayNext={showAutoplayNext}
                canPip={caps.pip}
                // Exactly the controls the bar could not keep at this width —
                // never both inline and in here, so nothing is duplicated.
                speed={caps.rate && compact ? { rate: prefs.rate, onRate: setRate } : null}
                episodeNav={
                  episodeNav && compact
                    ? {
                        hasPrev: episodeNav.hasPrev,
                        hasNext: episodeNav.hasNext,
                        onPrev: episodeNav.onPrev,
                        onNext: episodeNav.onNext,
                      }
                    : null
                }
                onBrightness={setBrightness}
                onZoom={setZoom}
                onToggleGestures={toggleGestures}
                onToggleAutoplayNext={() => updatePrefs({ autoplayNext: !prefs.autoplayNext })}
                onPip={requestPip}
                onReload={onReload}
                t={t}
              />
            </Popover>

            {episodesPanel && (
              <Popover
                open={menu === 'episodes'}
                onClose={() => setMenu(null)}
                label={t('episodes')}
                triggerRef={episodesBtn}
                className="fp-menu-wide"
              >
                {episodesPanel}
              </Popover>
            )}
          </div>
        )}

        {/* Single live region for state changes: "Paused", "Muted", "10 seconds
            forward". One region, so announcements never overlap. */}
        <p className="fp-sr-live" role="status" aria-live="polite">
          {announcement}
        </p>
      </div>

      {belowStage}
      {notice}
    </div>
  );
}
