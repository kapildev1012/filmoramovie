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
// The iframe is deliberately NOT sandboxed: these providers detect the sandbox
// attribute and refuse to run.

import {
  NO_CAPS,
  type PlayerAdapter,
  type PlayerCapabilities,
  type PlayerSource,
  type SnapshotSink,
} from '../types';

/** No `load` event by then ⇒ the provider is not going to render. */
const LOAD_TIMEOUT_MS = 14000;

/**
 * Every postMessage dialect these embed players are known to listen for. We
 * cannot know which one a given provider implements (or whether it implements
 * any), so all of them go out; unknown shapes are ignored by the receiver.
 */
function volumeMessages(volume01: number, muted: boolean): unknown[] {
  const pct = Math.round(volume01 * 100);
  return [
    { type: 'volume', volume: volume01 },
    { type: 'setVolume', value: volume01 },
    { type: 'PLAYER_VOLUME', volume: volume01 },
    { type: 'MEDIA_COMMAND', command: 'volume', value: volume01 },
    { event: 'command', func: 'setVolume', args: [pct] },
    { context: 'player.js', version: '0.0.11', method: 'setVolume', value: pct },
    { type: muted ? 'mute' : 'unmute' },
    { type: 'setMuted', value: muted },
    { context: 'player.js', version: '0.0.11', method: muted ? 'mute' : 'unmute' },
  ];
}

/** Pull {currentTime, duration} out of the many shapes providers emit. */
function readProgress(payload: unknown): { currentTime?: number; duration?: number } | null {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  const nested =
    (record.data as Record<string, unknown> | undefined) ??
    (record.detail as Record<string, unknown> | undefined) ??
    record;
  const time = Number(nested.currentTime ?? nested.time ?? nested.progress);
  const duration = Number(nested.duration ?? nested.total);
  const out: { currentTime?: number; duration?: number } = {};
  if (Number.isFinite(time) && time >= 0) out.currentTime = time;
  if (Number.isFinite(duration) && duration > 0) out.duration = duration;
  return out.currentTime !== undefined || out.duration !== undefined ? out : null;
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
    frame.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'no-referrer';
    frame.addEventListener('load', () => {
      window.clearTimeout(this.loadTimer);
      // A loaded provider frame is 'playing' from the shell's point of view: it
      // autoplays and we have no state to read. The pre-roll overlay is removed
      // so the viewer can reach the provider's own controls.
      sink({ status: 'playing', error: null });
      // Re-assert audio: a fresh document starts at its own default and has no
      // idea what the viewer picked. Providers build their <video> lazily, so
      // the message is repeated.
      window.setTimeout(() => this.pushVolume(), 800);
      window.setTimeout(() => this.pushVolume(), 2500);
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
      }
      const progress = readProgress(event.data);
      if (progress) {
        // The provider volunteers timing. Show a read-only progress bar; seeking
        // is still impossible, so caps.seek stays false.
        this.caps.time = true;
        sink(progress);
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
