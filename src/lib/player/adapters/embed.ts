// src/lib/player/adapters/embed.ts — third-party streaming provider engine.
//
// READ THIS BEFORE ADDING A CONTROL HERE
// --------------------------------------
// The video lives in a document on another origin. Same-origin policy means the
// parent page cannot read or write `currentTime`, `buffered`, `audioTracks`,
// `textTracks` or `playbackRate` — no API, no library, no workaround. So this
// adapter reports almost no capabilities and the UI hides those controls instead
// of drawing a seek bar that cannot seek.
//
// What it still does honestly:
//   • Volume/mute are RELAYED with every postMessage dialect these players are
//     known to accept (capability 'relay'), and the UI says so.
//   • Any message from the frame proves the provider's player is alive for this
//     title — better evidence than a server-side probe can get.
//   • A few providers volunteer progress telemetry ({currentTime, duration}).
//     When one does, `caps.time` flips on and a READ-ONLY progress bar appears.
//     Seeking stays impossible, so `caps.seek` remains false.
//   • A frame that never fires `load` is treated as a network failure so the
//     shell can fail over to another server.
//
// AD / POPUP / REDIRECT POSTURE (see mount())
// The iframe is NOT sandboxed. The `sandbox` attribute was removed on purpose,
// because several providers refuse to play (or render a black frame) inside a
// sandboxed document. Consequences, stated plainly:
//   • The provider's page can call window.open() — popunders / new-tab ads are
//     possible again. The browser's own popup blocker is now the only defence.
//   • The provider's page can set top.location — an embed is technically able to
//     redirect the whole site. Nothing in this app prevents that any more.
//   • Downloads, modals, pointer/orientation lock inside the frame are allowed.
// What still constrains the frame:
//   • `frame-src` / `child-src` in the page CSP (src/layouts/Layout.astro) — the
//     frame can only ever load the four provider origins we allowlist, so an
//     embed cannot be redirected to an arbitrary ad host.
//   • `referrerPolicy = 'no-referrer'` — providers never learn the page URL.
//   • Same-origin policy still applies: the provider's document cannot read or
//     script this page (that was never a sandbox feature).
// If popunders or top-level redirects start appearing in production, the fix is
// to put the sandbox back for the offending provider only:
//   frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation');
// Fullscreen is delegated via the `allow` / `allowFullscreen` attributes, not the
// sandbox, so it is unaffected either way.

import {
  NO_CAPS,
  type PlayerAdapter,
  type PlayerCapabilities,
  type PlayerSource,
  type SnapshotSink,
} from '../types';

/**
 * No `load` event by then ⇒ the provider is not going to render, so the shell
 * fails over to the next-best server.
 *
 * 4.5s, not 9s: this timer is the ONLY thing standing between a viewer and a
 * dead rectangle, and the automatic failover behind it is silent and cheap (the
 * next server is already ranked and its origin is pre-connected — see the
 * preconnect hints on the detail pages). A provider that has not returned a
 * document in four and a half seconds is not about to produce a good playback
 * experience, so waiting longer only spends the viewer's patience.
 *
 * This is deliberately a document-load deadline, not a playback deadline: the
 * `load` event fires as soon as the provider's HTML arrives, so a slow VIDEO on
 * a responsive server is not mistaken for a dead server.
 */
const LOAD_TIMEOUT_MS = 4500;

/**
 * Every postMessage dialect these embed players are plausibly listening for.
 *
 * WHAT WE ACTUALLY KNOW (checked against the providers' own documentation):
 * VidLink publishes a player API that is OUTBOUND ONLY — `MEDIA_DATA` and
 * `PLAYER_EVENT` messages travel frame → parent, and there is no documented
 * inbound command of any kind, volume included. VidFast, Videasy and NexStream
 * (vidking) publish no inbound API either. So there is no supported way for this
 * page to set the volume inside those players, and any claim to the contrary
 * would be a lie about a cross-origin document we cannot touch.
 *
 * We still send the bursts below, because they cost nothing and cover the common
 * player libraries these sites are built on (player.js, JW Player, Plyr /
 * Vidstack, and the generic {type,value} shape). Whichever dialect the provider's
 * bundle happens to understand wins; the rest are ignored by the receiver.
 * `caps.volume = 'relay'` is the honest label for that: commands are sent, never
 * confirmed, and the UI says so.
 */
function volumeMessages(volume01: number, muted: boolean): unknown[] {
  const pct = Math.round(volume01 * 100);
  return [
    // Generic shapes seen across these streaming front-ends.
    { type: 'volume', volume: volume01 },
    { type: 'volume', value: volume01 },
    { type: 'setVolume', value: volume01 },
    { type: 'PLAYER_VOLUME', volume: volume01 },
    { type: 'PLAYER_COMMAND', command: 'setVolume', value: volume01 },
    { type: 'MEDIA_COMMAND', command: 'volume', value: volume01 },
    { action: 'setVolume', volume: volume01 },
    // YouTube-style ({func, args}) — used by more embed wrappers than YouTube.
    { event: 'command', func: 'setVolume', args: [pct] },
    // player.js (embedly) — the de-facto standard for embedded players.
    { context: 'player.js', version: '0.0.11', method: 'setVolume', value: pct },
    // JW Player's iframe bridge (VidLink can be switched to JW with ?player=jw).
    { name: 'setVolume', type: 'jwplayer', value: pct },
    // Mute is a separate command in every one of those dialects.
    { type: muted ? 'mute' : 'unmute' },
    { type: 'setMuted', value: muted },
    { type: 'PLAYER_COMMAND', command: 'setMuted', value: muted },
    { action: muted ? 'mute' : 'unmute' },
    { event: 'command', func: muted ? 'mute' : 'unMute', args: [] },
    { context: 'player.js', version: '0.0.11', method: muted ? 'mute' : 'unmute' },
    { name: muted ? 'mute' : 'unmute', type: 'jwplayer' },
  ];
}

/**
 * "Give me the best rendition you have" in every dialect these embed players are
 * plausibly built on.
 *
 * SAME HONESTY AS volumeMessages(): none of the four providers documents an
 * inbound quality command, so this is a best-effort broadcast, not a contract.
 * Whichever dialect the provider's bundle understands wins; the rest are ignored
 * by the receiver. The URL also carries `quality=max&hd=1` (see lib/embed.ts) for
 * the front-ends that read their startup quality from the query string.
 *
 * Note the shape of the request: "highest / -1 / auto-off", never a number. A
 * hard 1080 would CAP a 4K stream, which is the opposite of the requirement.
 */
function maxQualityMessages(): unknown[] {
  return [
    // Generic shapes seen across these streaming front-ends.
    { type: 'quality', value: 'highest' },
    { type: 'quality', quality: 'highest' },
    { type: 'setQuality', value: 'highest' },
    { type: 'setQuality', value: -1 },
    { type: 'PLAYER_COMMAND', command: 'setQuality', value: 'highest' },
    { type: 'MEDIA_COMMAND', command: 'quality', value: 'highest' },
    { action: 'setQuality', quality: 'highest' },
    // hls.js-backed players: level -1 is "auto", so ask for the top level too.
    { type: 'setLevel', value: 'highest' },
    { type: 'hls', method: 'setNextLevel', value: -1 },
    // YouTube-style ({func,args}) — used by more embed wrappers than YouTube.
    { event: 'command', func: 'setPlaybackQuality', args: ['highres'] },
    { event: 'command', func: 'setPlaybackQualityRange', args: ['hd1080', 'highres'] },
    // player.js (embedly) — the de-facto standard for embedded players.
    { context: 'player.js', version: '0.0.11', method: 'setQuality', value: 'highest' },
    // JW Player's iframe bridge (VidLink can be switched to JW with ?player=jw).
    { name: 'setCurrentQuality', type: 'jwplayer', value: 0 },
  ];
}

/**
 * Parse a message from a provider frame.
 *
 * The one documented dialect among our providers is VidLink's, which is outbound
 * only: `{ type: 'PLAYER_EVENT', data: { event: 'play' | 'pause' | 'seeked' |
 * 'ended' | 'timeupdate', currentTime, duration, ... } }` plus a `MEDIA_DATA`
 * message carrying watch progress. Others emit similarly-shaped objects, so we
 * read defensively: any recognisable time/duration pair is used, and a
 * recognisable playback state is mapped, while anything unknown is ignored.
 */
function readProviderMessage(payload: unknown): {
  currentTime?: number;
  duration?: number;
  state?: 'playing' | 'paused' | 'ended';
  /**
   * Set when the frame itself says the title cannot be played. Several of these
   * players emit an error event before rendering their "no sources" screen, and
   * that message is the earliest honest signal we can act on — it turns a dead
   * rectangle into an automatic failover.
   */
  failure?: 'notfound' | 'network';
} | null {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  const nested =
    (record.data as Record<string, unknown> | undefined) ??
    (record.detail as Record<string, unknown> | undefined) ??
    record;

  const out: {
    currentTime?: number;
    duration?: number;
    state?: 'playing' | 'paused' | 'ended';
    failure?: 'notfound' | 'network';
  } = {};

  const time = Number(nested.currentTime ?? nested.time ?? nested.progress ?? nested.watched);
  const duration = Number(nested.duration ?? nested.total);
  if (Number.isFinite(time) && time >= 0) out.currentTime = time;
  if (Number.isFinite(duration) && duration > 0) out.duration = duration;

  const event = String(nested.event ?? nested.eventName ?? record.event ?? '').toLowerCase();
  if (event === 'pause' || event === 'paused') out.state = 'paused';
  else if (event === 'ended' || event === 'complete') out.state = 'ended';
  else if (event === 'play' || event === 'playing' || event === 'timeupdate' || event === 'seeked')
    out.state = 'playing';

  // Failure detection. Read conservatively: only an explicit error event or an
  // explicit error payload counts, because a false positive here would fail over
  // away from a server that was about to play.
  const type = String(record.type ?? '').toLowerCase();
  const rawMessage = String(
    (typeof nested.message === 'string' ? nested.message : '') ||
      (typeof nested.error === 'string' ? nested.error : '') ||
      (typeof record.error === 'string' ? record.error : '')
  ).toLowerCase();
  const errored =
    event === 'error' ||
    type === 'error' ||
    type === 'player_error' ||
    type === 'media_error' ||
    (nested.error !== undefined && nested.error !== null && nested.error !== false);
  if (errored) {
    out.failure =
      /not\s*found|no\s*(source|stream|video|file)|unavailable|404|missing/.test(rawMessage)
        ? 'notfound'
        : 'network';
  }

  return out.currentTime !== undefined || out.duration !== undefined || out.state || out.failure
    ? out
    : null;
}

export class EmbedAdapter implements PlayerAdapter {
  readonly engine = 'embed' as const;

  caps: PlayerCapabilities = {
    ...NO_CAPS,
    // Everything else is false and stays false — see the header comment.
    volume: 'relay',
  };

  /** True once the frame has answered at all (used for the honesty notice). */
  frameResponded = false;

  private frame: HTMLIFrameElement | null = null;
  private sink: SnapshotSink = () => {};
  private loadTimer: number | undefined;
  private onMessage: ((event: MessageEvent) => void) | null = null;
  private lastVolume = { volume: 1, muted: false };
  private destroyed = false;

  mount(host: HTMLElement, source: PlayerSource, sink: SnapshotSink): void {
    if (source.engine !== 'embed') return;
    this.sink = sink;
    sink({ status: 'loading', error: null });

    const frame = document.createElement('iframe');
    this.frame = frame;
    frame.className = 'fp-embed-frame';
    frame.src = source.url;
    frame.title = 'Streaming player';
    // FULLSCREEN + ZOOM DELEGATION (bug fix).
    // The provider's own fullscreen / expand button lives inside this document,
    // so it can only work if the frame is granted the fullscreen permission. All
    // four spellings are set on purpose:
    //   • allow="fullscreen"     — the modern Permissions-Policy delegation.
    //   • allowFullscreen        — the HTML attribute every current engine reads.
    //   • webkitallowfullscreen  — older WebKit/Safari builds.
    //   • mozallowfullscreen     — older Gecko builds.
    // `picture-in-picture` and `display-capture` are delegated too, because the
    // provider's UI offers PiP next to its fullscreen button and a frame without
    // the permission renders a button that silently does nothing.
    frame.allow = [
      'autoplay',
      'encrypted-media',
      'fullscreen',
      'picture-in-picture',
      'clipboard-write',
      'accelerometer',
      'gyroscope',
      'web-share',
      'screen-wake-lock',
    ].join('; ');
    frame.allowFullscreen = true;
    frame.setAttribute('allowfullscreen', '');
    frame.setAttribute('webkitallowfullscreen', 'true');
    frame.setAttribute('mozallowfullscreen', 'true');
    // Providers draw their own scrollbar-free layout; a scrollable frame would
    // let a stray ad div push the video out of view.
    frame.setAttribute('scrolling', 'no');
    frame.referrerPolicy = 'no-referrer';
    // NO SANDBOX (deliberate, requested). The frame runs with the provider's own
    // full privileges, exactly as if the viewer had opened the provider's page
    // directly. See the file header for what this re-enables and what still
    // constrains the frame.
    frame.addEventListener('load', () => {
      window.clearTimeout(this.loadTimer);
      // A loaded provider frame is 'playing' from the shell's point of view: it
      // autoplays and we have no state to read. The pre-roll overlay is removed
      // so the viewer can reach the provider's own controls.
      sink({ status: 'playing', error: null });
      // Never leave a title muted by default. A provider that autoplays often
      // starts its <video> muted to satisfy the browser's autoplay policy, so we
      // relay the viewer's real level (unmuted unless they chose otherwise) as
      // soon as the document exists and again as its player initialises lazily.
      // Repeated because there is no ack: whichever burst the provider's dialect
      // understands wins.
      //
      // Quality rides the same schedule: the renditions only exist once the
      // provider has parsed its manifest, which happens well after `load`, so a
      // single burst at load time would arrive before there is anything to
      // switch. 300ms / 800ms / 2.5s covers a normal manifest parse.
      this.pushConfiguration();
      window.setTimeout(() => this.pushConfiguration(), 300);
      window.setTimeout(() => this.pushConfiguration(), 800);
      window.setTimeout(() => this.pushConfiguration(), 2500);
    });
    host.appendChild(frame);

    this.loadTimer = window.setTimeout(() => {
      if (this.destroyed) return;
      sink({
        status: 'error',
        error: {
          kind: 'network',
          message: 'This server did not respond.',
          retryable: true,
        },
      });
    }, LOAD_TIMEOUT_MS);

    this.onMessage = (event: MessageEvent) => {
      const win = this.frame?.contentWindow;
      if (!win || event.source !== win) return;
      if (!this.frameResponded) {
        this.frameResponded = true;
        sink({ live: true, status: 'playing', error: null });
        // The provider's own player just came alive — re-assert the viewer's
        // volume and the max-quality request now that there is something
        // listening, so it is not left muted or on a 480p opening rendition.
        this.pushConfiguration();
      }
      const message = readProviderMessage(event.data);
      if (message) {
        // The frame reported its own failure. Surface it as a retryable engine
        // error so the island's failover walk moves to the next-best server
        // instead of leaving the viewer on a provider that just said no.
        if (message.failure) {
          this.sink({
            status: 'error',
            error: {
              kind: message.failure === 'notfound' ? 'notfound' : 'network',
              message:
                message.failure === 'notfound'
                  ? 'This server does not have this title.'
                  : 'This server could not start playback.',
              retryable: true,
            },
          });
          return;
        }
        if (message.currentTime !== undefined || message.duration !== undefined) {
          // The provider volunteers timing. Show a read-only progress bar and
          // feed Continue Watching; seeking is still impossible, so caps.seek
          // stays false.
          this.caps.time = true;
        }
        sink({
          ...(message.currentTime !== undefined ? { currentTime: message.currentTime } : {}),
          ...(message.duration !== undefined ? { duration: message.duration } : {}),
          // A real state from the provider beats our "the frame loaded, assume
          // playing" guess — this is what makes Up Next / the end card possible
          // on a server that reports its own `ended`.
          ...(message.state ? { status: message.state } : {}),
        });
      }
    };
    window.addEventListener('message', this.onMessage);
  }

  private pushVolume(): void {
    const win = this.frame?.contentWindow;
    if (!win) return;
    const { volume, muted } = this.lastVolume;
    const level = muted ? 0 : Math.max(0, Math.min(1, volume));
    for (const message of volumeMessages(level, muted || volume === 0)) {
      try {
        win.postMessage(message, '*');
      } catch {
        /* provider rejected this shape — the next dialect may land */
      }
    }
  }

  /**
   * Ask the provider's player for its best rendition.
   *
   * Fire-and-forget by nature (no ack is possible across origins), so this is
   * called on the same repeat schedule as the volume relay — the renditions do
   * not exist until the provider has parsed its manifest.
   */
  private pushMaxQuality(): void {
    const win = this.frame?.contentWindow;
    if (!win) return;
    for (const message of maxQualityMessages()) {
      try {
        win.postMessage(message, '*');
      } catch {
        /* provider rejected this shape — the next dialect may land */
      }
    }
  }

  /** Everything the player should be forced into on startup: full volume, best quality. */
  private pushConfiguration(): void {
    this.pushVolume();
    this.pushMaxQuality();
  }

  /** Nothing to do: the provider autoplays and we cannot command it. */
  play(): void {}
  pause(): void {}
  seek(): void {}
  setRate(): void {}
  selectAudioTrack(): void {}
  selectTextTrack(): void {}

  setVolume(volume: number, muted: boolean): void {
    this.lastVolume = { volume, muted };
    this.pushVolume();
    // Echo it so our own slider stays responsive even though we cannot verify
    // the provider applied it.
    this.sink({ volume, muted });
  }

  destroy(): void {
    this.destroyed = true;
    window.clearTimeout(this.loadTimer);
    if (this.onMessage) window.removeEventListener('message', this.onMessage);
    this.onMessage = null;
    this.frame?.remove();
    this.frame = null;
  }
}
