// src/lib/player/adapters/html5.ts — first-party <video> engine.
//
// The only engine with full capabilities: we own the element, so seeking, rate,
// audio renditions, captions and buffered ranges are all real.
//
// HLS: Safari (and iOS WebViews) play .m3u8 natively, which is also the only way
// to get AirPlay and hardware decoding there, so native is preferred. Everywhere
// else hls.js is loaded — and only then, via dynamic import, so the ~150KB never
// lands in the bundle for progressive MP4 titles or for viewers who never press
// Play.
//
// SUBTITLES: every text track is put in `mode = 'hidden'`, not 'showing'. The
// browser then parses and fires cues on time but paints nothing, and we render
// the cue text ourselves (see SubtitleLayer) to control font stack, RTL, size,
// backdrop and vertical position above the control bar. Timing still comes from
// the browser's own cue engine, so there is no drift.

import type HlsType from 'hls.js';
import type { ErrorData, Level, MediaPlaylist } from 'hls.js';
import {
  NO_CAPS,
  type ActiveCue,
  type AudioTrackInfo,
  type BufferedRange,
  type MediaSource as FilmoraMediaSource,
  type PlayerAdapter,
  type PlayerCapabilities,
  type PlayerError,
  type PlayerSource,
  type SnapshotSink,
  type TextTrackInfo,
} from '../types';
import { languageDirection } from '../languages';
import { ThumbnailProvider } from '../thumbnails';

/** How often the progress loop pushes a patch while playing (ms). */
const PROGRESS_INTERVAL = 125;

/** Minimum stall before we call it "buffering" — avoids a flickering spinner. */
const STALL_GRACE_MS = 350;

type NativeAudioTrackList = {
  length: number;
  [index: number]: { id: string; language: string; label: string; enabled: boolean };
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
};

function guessType(src: string): 'hls' | 'dash' | 'progressive' {
  const path = src.split('?')[0]?.toLowerCase() ?? '';
  if (path.endsWith('.m3u8')) return 'hls';
  if (path.endsWith('.mpd')) return 'dash';
  return 'progressive';
}

function mapMediaError(video: HTMLVideoElement): PlayerError {
  const code = video.error?.code;
  switch (code) {
    case 1: // MEDIA_ERR_ABORTED
      return { kind: 'aborted', message: 'Playback was aborted.', retryable: true };
    case 2: // MEDIA_ERR_NETWORK
      return { kind: 'network', message: 'Network error while loading the video.', retryable: true };
    case 3: // MEDIA_ERR_DECODE
      return { kind: 'decode', message: 'The video could not be decoded.', retryable: false };
    case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
      return { kind: 'unsupported', message: 'This video format is not supported.', retryable: false };
    default:
      return { kind: 'unknown', message: 'Playback failed.', retryable: true };
  }
}

export class Html5Adapter implements PlayerAdapter {
  readonly engine = 'html5' as const;

  /**
   * Capabilities are refined during mount: `thumbnails` only becomes true once a
   * preview source is proven, and `audioTracks` once more than one exists. The
   * object identity is kept stable and mutated before the first sink patch, so
   * the UI never renders a control that then disappears.
   */
  caps: PlayerCapabilities = {
    ...NO_CAPS,
    time: true,
    seek: true,
    buffered: true,
    playback: true,
    rate: true,
    volume: 'native',
    subtitleStyling: true,
    pip: typeof document !== 'undefined' && 'pictureInPictureEnabled' in document,
    endedSignal: true,
  };

  private video: HTMLVideoElement | null = null;
  private hls: HlsType | null = null;
  private sink: SnapshotSink = () => {};
  private thumbs: ThumbnailProvider | null = null;
  private progressTimer: number | undefined;
  private stallTimer: number | undefined;
  private destroyed = false;
  /** our text-track id -> hls.js subtitle track index (in-manifest subs only) */
  private hlsSubtitleIndex = new Map<string, number>();
  private trackListeners: Array<() => void> = [];

  async mount(host: HTMLElement, source: PlayerSource, sink: SnapshotSink): Promise<void> {
    if (source.engine !== 'html5') return;
    this.sink = sink;
    const media = source.media;

    const video = document.createElement('video');
    this.video = video;
    video.className = 'fp-video';
    // playsInline: without it iOS Safari hijacks playback into its own
    // fullscreen player and every control we drew disappears.
    video.playsInline = true;
    video.preload = 'metadata';
    video.tabIndex = -1; // the stage owns focus and keyboard handling
    // Custom chrome only. The element is created detached and without a
    // `controls` attribute, so there is nothing to flash on first paint — but we
    // still set the IDL property explicitly (default is already false) so no
    // upstream default, cloned node or WebKit state can ever flip the browser's
    // own control bar on. Safari re-injection on fullscreen is handled in
    // attachElementListeners().
    video.controls = false;
    // NOTE: `disablepictureinpicture` is a *boolean* attribute — its mere
    // presence disables PiP regardless of the string value, so the previous
    // `setAttribute('disablepictureinpicture', 'false')` actually DISABLED PiP
    // and left the shell's PiP button (rendered because caps.pip is true) doing
    // nothing. Use the IDL property so PiP stays available.
    video.disablePictureInPicture = false;
    if (media.poster) video.poster = media.poster;
    if (media.crossOrigin) video.crossOrigin = media.crossOrigin;
    host.appendChild(video);

    this.attachElementListeners(video);
    sink({ status: 'loading', error: null });

    const kind = media.type ?? guessType(media.src);
    const nativeHls = video.canPlayType('application/vnd.apple.mpegurl') !== '';

    if (kind === 'hls' && !nativeHls) {
      await this.attachHls(video, media.src);
    } else if (kind === 'dash') {
      // No DASH engine is bundled. Safari cannot play .mpd either, so fail with
      // a precise reason instead of a silent black frame.
      sink({
        status: 'error',
        error: {
          kind: 'unsupported',
          message: 'DASH playback is not enabled on this site.',
          retryable: false,
        },
      });
      return;
    } else {
      video.src = media.src;
    }

    // Sidecar subtitles (WebVTT files listed on the source).
    for (const [index, track] of (media.textTracks ?? []).entries()) {
      const el = document.createElement('track');
      el.kind = track.kind ?? 'subtitles';
      el.srclang = track.lang;
      el.label = track.label ?? track.lang;
      el.src = track.src;
      // `default` would make the browser paint its own cues; we render them.
      el.id = `sidecar-${index}`;
      video.appendChild(el);
    }

    if (source.startAt && source.startAt > 0) {
      // Applied on loadedmetadata: setting currentTime before then is ignored.
      const seekOnce = () => {
        try {
          video.currentTime = source.startAt!;
        } catch {
          /* seeking not ready — resume position is best-effort */
        }
      };
      video.addEventListener('loadedmetadata', seekOnce, { once: true });
    }

    await this.setupThumbnails(media);
    this.syncTracks();
    this.startProgressLoop();
  }

  // ── hls.js ────────────────────────────────────────────────────────────────
  private async attachHls(video: HTMLVideoElement, src: string): Promise<void> {
    try {
      const mod = await import('hls.js');
      const Hls = mod.default;
      if (this.destroyed) return;
      if (!Hls.isSupported()) {
        this.sink({
          status: 'error',
          error: {
            kind: 'unsupported',
            message: 'This browser cannot play adaptive streams.',
            retryable: false,
          },
        });
        return;
      }
      const hls = new Hls({
        // Start conservatively so the first frames arrive fast on mobile data,
        // then let ABR climb.
        startLevel: -1,
        capLevelToPlayerSize: true,
        maxBufferLength: 30,
        enableWorker: true,
      });
      this.hls = hls;
      hls.attachMedia(video);
      hls.loadSource(src);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        this.syncTracks();
        this.sink({ status: 'ready' });
      });
      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => this.syncTracks());
      hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, () => this.syncTracks());
      hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data: { level: number }) => {
        const level: Level | undefined = hls.levels?.[data.level];
        this.sink({
          quality: level?.height ? `${level.height}p` : null,
          bandwidth: Math.round(hls.bandwidthEstimate || 0) || null,
        });
      });
      hls.on(Hls.Events.ERROR, (_e, data: ErrorData) => {
        if (!data.fatal) return; // hls.js recovers non-fatal errors itself
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          // One silent recovery attempt: a dropped segment on mobile is normal
          // and should not surface an error card.
          hls.startLoad();
          this.sink({
            status: 'error',
            error: {
              kind: 'network',
              message: 'The stream connection dropped.',
              retryable: true,
            },
          });
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
          this.sink({
            status: 'error',
            error: { kind: 'decode', message: 'The stream could not be decoded.', retryable: true },
          });
        } else if (data.type === Hls.ErrorTypes.KEY_SYSTEM_ERROR) {
          this.sink({
            status: 'error',
            error: { kind: 'drm', message: 'This stream is protected.', retryable: false },
          });
        } else {
          this.sink({
            status: 'error',
            error: { kind: 'unknown', message: 'The stream stopped.', retryable: true },
          });
        }
      });
      this.caps.qualityInfo = true;
    } catch {
      this.sink({
        status: 'error',
        error: {
          kind: 'unsupported',
          message: 'The streaming engine could not be loaded.',
          retryable: true,
        },
      });
    }
  }

  // ── Thumbnails ────────────────────────────────────────────────────────────
  private async setupThumbnails(media: FilmoraMediaSource): Promise<void> {
    const kind = media.type ?? guessType(media.src);
    // Frame sampling needs a seekable single file plus CORS clearance.
    const canSample = kind === 'progressive' && (!!media.crossOrigin || isSameOrigin(media.src));
    const provider = new ThumbnailProvider(media.src, media.crossOrigin, canSample);
    this.thumbs = provider;
    if (media.thumbnailsVtt) await provider.loadVtt(media.thumbnailsVtt);
    if (this.destroyed) return;
    this.caps.thumbnails = provider.available;
  }

  thumbnailAt(seconds: number) {
    return this.thumbs?.at(seconds) ?? null;
  }

  // ── Element wiring ────────────────────────────────────────────────────────
  private attachElementListeners(video: HTMLVideoElement): void {
    const on = (type: string, handler: EventListener) => {
      video.addEventListener(type, handler);
      this.trackListeners.push(() => video.removeEventListener(type, handler));
    };

    on('loadedmetadata', () => {
      this.sink({ duration: Number.isFinite(video.duration) ? video.duration : 0, status: 'ready' });
      this.syncTracks();
    });
    on('durationchange', () =>
      this.sink({ duration: Number.isFinite(video.duration) ? video.duration : 0 })
    );
    on('play', () => this.sink({ status: 'playing', error: null }));
    on('playing', () => {
      window.clearTimeout(this.stallTimer);
      this.sink({ status: 'playing', live: true, error: null });
    });
    on('pause', () => {
      // `pause` also fires right before `ended`; ended wins.
      if (!video.ended) this.sink({ status: 'paused' });
    });
    on('waiting', () => {
      // Grace period: a sub-350ms stall is invisible and a spinner for it is
      // worse than no spinner.
      window.clearTimeout(this.stallTimer);
      this.stallTimer = window.setTimeout(() => {
        if (!video.paused && !video.ended) this.sink({ status: 'buffering' });
      }, STALL_GRACE_MS);
    });
    on('ended', () => this.sink({ status: 'ended', currentTime: video.duration || 0 }));
    on('ratechange', () => this.sink({ rate: video.playbackRate }));
    on('volumechange', () => this.sink({ volume: video.volume, muted: video.muted }));
    on('error', () => this.sink({ status: 'error', error: mapMediaError(video) }));
    on('seeked', () => this.pushProgress());
    on('progress', () => this.pushProgress());

    // ── Native track lists (Safari / iOS native HLS) ──────────────────────────
    // The hls.js path already re-syncs on AUDIO_TRACKS_UPDATED /
    // SUBTITLE_TRACKS_UPDATED. When Safari plays the .m3u8 natively there is no
    // hls.js: the alternate audio renditions and in-manifest subtitle tracks are
    // surfaced on `video.audioTracks` / `video.textTracks`, and WebKit populates
    // them *asynchronously* — often a beat AFTER `loadedmetadata`, and they can
    // change again mid-playback. `syncTracks()` previously ran only on
    // loadedmetadata, so it captured just the tracks present in that first frame
    // — typically the main audio alone. To the viewer that reads as "only the
    // original language is available". Re-sync whenever a track is added,
    // removed, or its enabled/selected state changes so every rendition appears
    // (and the language switcher shows up) the moment WebKit knows about it —
    // without touching currentTime, so playback never restarts.
    const resync = () => this.syncTracks();
    const nativeAudio = (video as HTMLVideoElement & { audioTracks?: NativeAudioTrackList })
      .audioTracks;
    if (nativeAudio?.addEventListener) {
      for (const type of ['addtrack', 'removetrack', 'change'] as const) {
        nativeAudio.addEventListener(type, resync);
        this.trackListeners.push(() => nativeAudio.removeEventListener?.(type, resync));
      }
    }
    const textList = video.textTracks;
    for (const type of ['addtrack', 'removetrack', 'change'] as const) {
      textList.addEventListener(type, resync);
      this.trackListeners.push(() => textList.removeEventListener(type, resync));
    }

    // ── Keep native controls suppressed (defensive; fixes Safari) ─────────────
    // WebKit re-enables its own control bar when a <video> enters *native*
    // fullscreen or picture-in-picture presentation mode, even when the element
    // was created without a `controls` attribute and we drew our own chrome.
    // Re-assert on the WebKit-specific presentation event and on the standard
    // fullscreenchange so the native bar can never flash over our controls.
    const suppressNativeControls = () => {
      video.controls = false;
    };
    on('webkitpresentationmodechanged', suppressNativeControls);
    on('webkitbeginfullscreen', suppressNativeControls);
    on('webkitendfullscreen', suppressNativeControls);
    document.addEventListener('fullscreenchange', suppressNativeControls);
    this.trackListeners.push(() =>
      document.removeEventListener('fullscreenchange', suppressNativeControls)
    );
  }

  /** Rebuild the audio/text track lists and re-arm cue listeners. */
  private syncTracks(): void {
    const video = this.video;
    if (!video) return;

    // ── Audio ──
    const audio: AudioTrackInfo[] = [];
    if (this.hls?.audioTracks?.length) {
      this.hls.audioTracks.forEach((t: MediaPlaylist, index: number) => {
        audio.push({
          id: `hls-audio-${index}`,
          lang: t.lang ?? 'und',
          label: t.name,
          channels: t.channels ? Number(t.channels) : undefined,
          active: this.hls?.audioTrack === index,
        });
      });
    } else {
      const native = (video as HTMLVideoElement & { audioTracks?: NativeAudioTrackList })
        .audioTracks;
      if (native?.length) {
        for (let i = 0; i < native.length; i += 1) {
          const t = native[i]!;
          audio.push({
            id: t.id || `native-audio-${i}`,
            lang: t.language || 'und',
            label: t.label || undefined,
            active: t.enabled,
          });
        }
      }
    }
    this.caps.audioTracks = audio.length > 1;

    // ── Text ──
    const text: TextTrackInfo[] = [];
    this.hlsSubtitleIndex.clear();
    const list = video.textTracks;
    for (let i = 0; i < list.length; i += 1) {
      const track = list[i]!;
      if (track.kind !== 'subtitles' && track.kind !== 'captions') continue;
      const id = `text-${i}`;
      text.push({
        id,
        lang: track.language || 'und',
        label: track.label || undefined,
        kind: track.kind === 'captions' ? 'captions' : 'subtitles',
        active: track.mode === 'hidden' || track.mode === 'showing',
      });
      // Match hls.js's own subtitle list so switching also loads segments.
      const hlsIndex = this.hls?.subtitleTracks?.findIndex(
        (s: MediaPlaylist) =>
          (s.lang ?? '') === (track.language ?? '') && (s.name ?? '') === (track.label ?? '')
      );
      if (hlsIndex !== undefined && hlsIndex >= 0) this.hlsSubtitleIndex.set(id, hlsIndex);

      // One cuechange listener per track; hidden tracks still fire it.
      if (!track.oncuechange) {
        track.oncuechange = () => this.pushCues(track);
      }
    }
    this.caps.textTracks = text.length > 0;

    this.sink({ audioTracks: audio, textTracks: text });
  }

  /** Convert the browser's active cues into render-ready lines. */
  private pushCues(track: TextTrack): void {
    if (track.mode === 'disabled') {
      this.sink({ cues: [] });
      return;
    }
    const dir = languageDirection(track.language);
    const cues: ActiveCue[] = [];
    const active = track.activeCues;
    for (let i = 0; i < (active?.length ?? 0); i += 1) {
      const cue = active![i] as VTTCue;
      const raw = typeof cue.text === 'string' ? cue.text : '';
      cues.push({
        id: cue.id || `${track.language}-${cue.startTime}-${i}`,
        // WebVTT allows inline tags (<i>, <c.classname>, <v Speaker>); strip
        // them rather than injecting markup, and keep the line breaks.
        lines: raw
          .replace(/<[^>]+>/g, '')
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean),
        lang: track.language || 'und',
        dir,
      });
    }
    this.sink({ cues });
  }

  // ── Progress loop ─────────────────────────────────────────────────────────
  private startProgressLoop(): void {
    const tick = () => {
      if (this.destroyed) return;
      this.pushProgress();
      this.progressTimer = window.setTimeout(tick, PROGRESS_INTERVAL);
    };
    tick();
  }

  private pushProgress(): void {
    const video = this.video;
    if (!video) return;
    const ranges: BufferedRange[] = [];
    for (let i = 0; i < video.buffered.length; i += 1) {
      ranges.push({ start: video.buffered.start(i), end: video.buffered.end(i) });
    }
    this.sink({ currentTime: video.currentTime, buffered: ranges });
  }

  // ── Commands ──────────────────────────────────────────────────────────────
  /**
   * Start playback, handling the browser's autoplay policy the way the big
   * services do.
   *
   * A `play()` rejected with NotAllowedError means "not with sound, not without a
   * gesture". Chrome/Safari will however allow the SAME call muted, so instead of
   * leaving a dead poster we mute, start, and flag `autoplayBlocked` so the shell
   * can offer a one-tap unmute. Any other rejection is left alone: the play
   * button is still on screen and pressing it carries a fresh gesture.
   */
  play(): void | Promise<void> {
    const video = this.video;
    if (!video) return;
    return video.play().catch((error: unknown) => {
      const blocked =
        error instanceof DOMException
          ? error.name === 'NotAllowedError'
          : (error as { name?: string })?.name === 'NotAllowedError';
      if (!blocked || video.muted) return;
      video.muted = true;
      return video
        .play()
        .then(() => {
          // Only report the muted fallback once it has actually succeeded —
          // otherwise the prompt would appear over a video that is not playing.
          this.sink({ autoplayBlocked: true, muted: true });
        })
        .catch(() => {
          // Even muted autoplay was refused (Low Power Mode, Data Saver). Undo
          // the mute so the viewer's own Play press starts with real sound.
          video.muted = false;
        });
    });
  }

  pause(): void {
    this.video?.pause();
  }

  seek(seconds: number): void {
    const video = this.video;
    if (!video) return;
    const max = Number.isFinite(video.duration) ? video.duration : seconds;
    try {
      video.currentTime = Math.max(0, Math.min(seconds, max));
    } catch {
      /* not seekable yet */
    }
    this.pushProgress();
  }

  setRate(rate: number): void {
    if (this.video) this.video.playbackRate = rate;
  }

  setVolume(volume: number, muted: boolean): void {
    if (!this.video) return;
    this.video.volume = Math.max(0, Math.min(1, volume));
    this.video.muted = muted;
  }

  selectAudioTrack(id: string): void {
    if (this.hls) {
      const index = Number(id.replace('hls-audio-', ''));
      if (!Number.isNaN(index)) this.hls.audioTrack = index;
      this.syncTracks();
      return;
    }
    const native = (this.video as (HTMLVideoElement & { audioTracks?: NativeAudioTrackList }) | null)
      ?.audioTracks;
    if (!native) return;
    for (let i = 0; i < native.length; i += 1) {
      const track = native[i]!;
      track.enabled = (track.id || `native-audio-${i}`) === id;
    }
    this.syncTracks();
  }

  selectTextTrack(id: string | null): void {
    const video = this.video;
    if (!video) return;
    const list = video.textTracks;
    for (let i = 0; i < list.length; i += 1) {
      const track = list[i]!;
      if (track.kind !== 'subtitles' && track.kind !== 'captions') continue;
      // 'hidden' = parse + fire cues, paint nothing (we render them).
      track.mode = `text-${i}` === id ? 'hidden' : 'disabled';
    }
    if (this.hls) {
      const hlsIndex = id ? this.hlsSubtitleIndex.get(id) : undefined;
      this.hls.subtitleTrack = hlsIndex ?? -1;
    }
    this.sink({ cues: [] });
    this.syncTracks();
  }

  requestPictureInPicture(): void {
    const video = this.video as (HTMLVideoElement & {
      requestPictureInPicture?: () => Promise<unknown>;
    }) | null;
    if (document.pictureInPictureElement) {
      void document.exitPictureInPicture().catch(() => undefined);
      return;
    }
    void video?.requestPictureInPicture?.().catch(() => undefined);
  }

  destroy(): void {
    this.destroyed = true;
    window.clearTimeout(this.progressTimer);
    window.clearTimeout(this.stallTimer);
    this.trackListeners.forEach((off) => off());
    this.trackListeners = [];
    const video = this.video;
    if (video) {
      const list = video.textTracks;
      for (let i = 0; i < list.length; i += 1) list[i]!.oncuechange = null;
      video.pause();
      video.removeAttribute('src');
      video.load(); // releases the decoder; without it iOS leaks media sessions
      video.remove();
    }
    this.video = null;
    this.hls?.destroy();
    this.hls = null;
    this.thumbs?.destroy();
    this.thumbs = null;
  }
}

function isSameOrigin(url: string): boolean {
  try {
    return new URL(url, location.href).origin === location.origin;
  } catch {
    return false;
  }
}
