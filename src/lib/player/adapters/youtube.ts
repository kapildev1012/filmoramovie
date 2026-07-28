// src/lib/player/adapters/youtube.ts — TMDB trailer engine (YouTube IFrame API).
//
// Cross-origin, but unlike the streaming-provider iframes YouTube ships a real
// command API, so the same control bar drives it: seek, ±10s, playback rate,
// exact volume, captions, and a trustworthy `ended` event. What it cannot do is
// expose audio renditions or hand us cue text, so `audioTracks`,
// `subtitleStyling` and `thumbnails` stay false and the UI hides those controls
// rather than faking them.
//
// The API script is loaded once per document and shared by every island.

import {
  NO_CAPS,
  type PlayerAdapter,
  type PlayerCapabilities,
  type PlayerSource,
  type SnapshotSink,
  type TextTrackInfo,
} from '../types';

/** Poll interval for time/buffer — YouTube has no timeupdate event. */
const POLL_INTERVAL = 200;

interface YtCaptionTrack {
  languageCode: string;
  languageName?: string;
  displayName?: string;
  is_translateable?: boolean;
  kind?: string;
}

interface YtPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getVideoLoadedFraction(): number;
  setVolume(percent: number): void;
  mute(): void;
  unMute(): void;
  setPlaybackRate(rate: number): void;
  getPlaybackQuality?(): string;
  loadModule(name: string): void;
  getOption(module: string, option: string): unknown;
  setOption(module: string, option: string, value: unknown): void;
  destroy(): void;
  getIframe?(): HTMLIFrameElement;
}

interface YtNamespace {
  Player: new (
    host: HTMLElement | string,
    config: Record<string, unknown>
  ) => YtPlayer;
  PlayerState: { UNSTARTED: -1; ENDED: 0; PLAYING: 1; PAUSED: 2; BUFFERING: 3; CUED: 5 };
}

declare global {
  interface Window {
    YT?: YtNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YtNamespace> | null = null;

/** Load (once) and resolve the global YT namespace. */
function loadYouTubeApi(): Promise<YtNamespace> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<YtNamespace>((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error('YouTube API load timeout')),
      12000
    );
    // The API calls this global exactly once when it is ready. Chain any
    // previously registered callback so we never clobber another consumer.
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      window.clearTimeout(timer);
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error('YouTube API missing'));
    };
    const existing = document.querySelector<HTMLScriptElement>('script[data-fp-youtube-api]');
    if (!existing) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.dataset.fpYoutubeApi = 'true';
      script.onerror = () => {
        window.clearTimeout(timer);
        reject(new Error('YouTube API blocked'));
      };
      document.head.appendChild(script);
    }
  }).catch((err: unknown) => {
    apiPromise = null; // allow a retry after a network failure
    throw err;
  });

  return apiPromise;
}

/** Map YouTube's quality strings to the labels a viewer recognises. */
const QUALITY_LABEL: Record<string, string> = {
  tiny: '144p',
  small: '240p',
  medium: '360p',
  large: '480p',
  hd720: '720p',
  hd1080: '1080p',
  hd1440: '1440p',
  hd2160: '2160p',
  highres: 'Max',
};

export class YouTubeAdapter implements PlayerAdapter {
  readonly engine = 'youtube' as const;

  caps: PlayerCapabilities = {
    ...NO_CAPS,
    time: true,
    seek: true,
    buffered: true,
    playback: true,
    rate: true,
    volume: 'native', // exact, and it reliably applies
    qualityInfo: true,
    endedSignal: true,
  };

  private player: YtPlayer | null = null;
  private sink: SnapshotSink = () => {};
  private poll: number | undefined;
  private destroyed = false;
  private captionsChecked = false;
  private pendingVolume: { volume: number; muted: boolean } | null = null;
  private pendingRate: number | null = null;
  private wantedCaptionLang: string | null = null;
  /** Last state YouTube reported; used to detect a refused autoplay. */
  private started = false;
  private autoplayProbe: number | undefined;

  async mount(host: HTMLElement, source: PlayerSource, sink: SnapshotSink): Promise<void> {
    if (source.engine !== 'youtube') return;
    this.sink = sink;
    sink({ status: 'loading', error: null });

    let YT: YtNamespace;
    try {
      YT = await loadYouTubeApi();
    } catch {
      sink({
        status: 'error',
        error: {
          kind: 'network',
          message: 'The trailer player could not be loaded.',
          retryable: true,
        },
      });
      return;
    }
    if (this.destroyed) return;

    // The API replaces this element with its iframe.
    const mountPoint = document.createElement('div');
    mountPoint.className = 'fp-yt';
    host.appendChild(mountPoint);
    this.wantedCaptionLang = source.ccLang ?? null;

    this.player = new YT.Player(mountPoint, {
      videoId: source.videoId,
      playerVars: {
        // controls:0 — Filmora draws the controls; the player itself stays
        // visible and unobscured, which is what the IFrame API expects.
        controls: 0,
        disablekb: 1, // our own keyboard handler owns shortcuts
        modestbranding: 1,
        rel: 0,
        playsinline: 1,
        fs: 0, // fullscreen is our stage's job, not the iframe's
        cc_load_policy: source.ccLang ? 1 : 0,
        cc_lang_pref: source.ccLang ?? undefined,
        start: source.startAt ? Math.floor(source.startAt) : undefined,
        origin: window.location.origin,
      },
      events: {
        onReady: () => {
          if (this.destroyed) return;
          // Commands issued before the player existed are replayed here.
          if (this.pendingVolume) this.setVolume(this.pendingVolume.volume, this.pendingVolume.muted);
          if (this.pendingRate !== null) this.setRate(this.pendingRate);
          sink({
            status: 'ready',
            duration: this.player?.getDuration() ?? 0,
          });
          this.startPolling();
        },
        onStateChange: (event: { data: number }) => {
          const S = YT.PlayerState;
          switch (event.data) {
            case S.PLAYING:
              this.started = true;
              window.clearTimeout(this.autoplayProbe);
              sink({ status: 'playing', live: true, error: null, duration: this.player?.getDuration() ?? 0 });
              this.loadCaptionList();
              break;
            case S.PAUSED:
              sink({ status: 'paused' });
              break;
            case S.BUFFERING:
              this.started = true;
              window.clearTimeout(this.autoplayProbe);
              sink({ status: 'buffering' });
              break;
            case S.ENDED:
              sink({ status: 'ended' });
              break;
            case S.CUED:
              sink({ status: 'ready' });
              break;
            default:
              break;
          }
        },
        onPlaybackQualityChange: () => {
          const q = this.player?.getPlaybackQuality?.();
          sink({ quality: q ? QUALITY_LABEL[q] ?? q : null });
        },
        onError: (event: { data: number }) => {
          // 2 invalid id · 5 HTML5 error · 100 removed/private · 101/150 embedding
          // disabled by the uploader (very common for studio trailers).
          const code = event.data;
          const kind =
            code === 100 ? 'notfound' : code === 101 || code === 150 ? 'geo' : 'unknown';
          sink({
            status: 'error',
            error: {
              kind,
              message:
                kind === 'geo'
                  ? 'The rights holder does not allow this trailer to play outside YouTube.'
                  : kind === 'notfound'
                    ? 'This trailer is no longer available.'
                    : 'The trailer could not be played.',
              retryable: kind === 'unknown',
            },
          });
        },
      },
    });
  }

  /**
   * YouTube only populates the caption track list after the captions module has
   * initialised, which happens a beat into playback. Poll a few times, then give
   * up quietly — a trailer with no captions must show "none available", not an
   * empty menu.
   */
  private loadCaptionList(attempt = 0): void {
    if (this.destroyed || this.captionsChecked || !this.player) return;
    try {
      this.player.loadModule('captions');
      const raw = this.player.getOption('captions', 'tracklist');
      const list = Array.isArray(raw) ? (raw as YtCaptionTrack[]) : [];
      if (list.length === 0) {
        if (attempt < 5) {
          window.setTimeout(() => this.loadCaptionList(attempt + 1), 700);
          return;
        }
        this.captionsChecked = true;
        this.caps.textTracks = false;
        this.sink({ textTracks: [] });
        return;
      }
      this.captionsChecked = true;
      this.caps.textTracks = true;
      const active = (this.player.getOption('captions', 'track') ?? {}) as { languageCode?: string };
      const tracks: TextTrackInfo[] = list.map((t) => ({
        id: t.languageCode,
        lang: t.languageCode,
        label: t.displayName ?? t.languageName,
        kind: 'subtitles',
        active: active.languageCode === t.languageCode,
      }));
      this.sink({ textTracks: tracks });
      // Apply the remembered subtitle language now that the list exists.
      if (this.wantedCaptionLang) {
        const match =
          tracks.find((t) => t.lang === this.wantedCaptionLang) ??
          tracks.find((t) => t.lang.split('-')[0] === this.wantedCaptionLang?.split('-')[0]);
        if (match) this.selectTextTrack(match.id);
      }
    } catch {
      this.captionsChecked = true;
      this.caps.textTracks = false;
    }
  }

  private startPolling(): void {
    const tick = () => {
      if (this.destroyed || !this.player) return;
      try {
        const duration = this.player.getDuration() || 0;
        const fraction = this.player.getVideoLoadedFraction() || 0;
        this.sink({
          currentTime: this.player.getCurrentTime() || 0,
          duration,
          // YouTube reports one fraction, not ranges. Modelling it as a single
          // range from 0 is honest enough for the buffered bar.
          buffered: duration > 0 ? [{ start: 0, end: fraction * duration }] : [],
        });
      } catch {
        /* player torn down between ticks */
      }
      this.poll = window.setTimeout(tick, POLL_INTERVAL);
    };
    tick();
  }

  /**
   * Start playback, with the same autoplay-policy fallback as the <video>
   * engine.
   *
   * The IFrame API has no rejected promise to inspect: a refused autoplay simply
   * leaves the player in UNSTARTED forever. So we ask, then check. If nothing has
   * begun after the grace period we mute and ask again — the one thing every
   * browser still allows — and flag `autoplayBlocked` so the shell can offer
   * one-tap sound instead of showing a frozen poster.
   */
  play(): void {
    const player = this.player;
    if (!player) return;
    player.playVideo();
    window.clearTimeout(this.autoplayProbe);
    this.autoplayProbe = window.setTimeout(() => {
      if (this.destroyed || this.started || !this.player) return;
      try {
        this.player.mute();
        this.player.playVideo();
        this.sink({ autoplayBlocked: true, muted: true });
      } catch {
        /* player torn down mid-check */
      }
    }, 1200);
  }

  pause(): void {
    this.player?.pauseVideo();
  }

  seek(seconds: number): void {
    this.player?.seekTo(Math.max(0, seconds), true);
  }

  setRate(rate: number): void {
    if (!this.player) {
      this.pendingRate = rate;
      return;
    }
    this.player.setPlaybackRate(rate);
    this.sink({ rate });
  }

  setVolume(volume: number, muted: boolean): void {
    if (!this.player) {
      this.pendingVolume = { volume, muted };
      return;
    }
    this.player.setVolume(Math.round(Math.max(0, Math.min(1, volume)) * 100));
    if (muted) this.player.mute();
    else this.player.unMute();
    this.sink({ volume, muted });
  }

  selectAudioTrack(): void {
    /* YouTube exposes no audio rendition API — caps.audioTracks is false. */
  }

  selectTextTrack(id: string | null): void {
    if (!this.player) return;
    try {
      if (id === null) {
        this.player.setOption('captions', 'track', {});
      } else {
        this.player.setOption('captions', 'track', { languageCode: id });
      }
      this.sink({
        textTracks: [],
      });
      // Re-read the list so `active` reflects reality rather than our guess.
      this.captionsChecked = false;
      this.loadCaptionList();
    } catch {
      /* captions module not ready */
    }
  }

  destroy(): void {
    this.destroyed = true;
    window.clearTimeout(this.poll);
    window.clearTimeout(this.autoplayProbe);
    try {
      this.player?.destroy();
    } catch {
      /* already gone */
    }
    this.player = null;
  }
}
