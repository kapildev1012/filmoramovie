// src/lib/player/thumbnails.ts — scrub-preview frames for the seek bar.
//
// TWO SOURCES, IN ORDER OF PREFERENCE
// 1. A WebVTT thumbnail track (`MediaSource.thumbnailsVtt`). This is what every
//    CDN emits for "trick play": cues whose payload is an image URL with a
//    sprite rectangle, `sprite.jpg#xywh=160,0,160,90`. One request, no decoding,
//    works while paused, and is the only option for HLS/DASH.
// 2. Live frame sampling from a second, hidden <video>. Used when no VTT exists
//    and the media is CORS-clean (a tainted canvas throws on drawImage). Frames
//    are sampled into 10s buckets on demand and cached as blob URLs.
//
// `at()` is deliberately synchronous: the seek bar calls it on every pointermove
// and must never await. It returns the best frame it already has (a neighbouring
// bucket if the exact one is not ready) and schedules the missing one, so the
// preview fills in as the viewer scrubs instead of blocking the drag.

export interface ThumbnailFrame {
  url: string;
  /** Sprite offset in pixels; 0 for a standalone image. */
  x: number;
  y: number;
  /** Rectangle size in pixels — also the intrinsic size for sampled frames. */
  w: number;
  h: number;
}

interface VttThumbCue {
  start: number;
  end: number;
  frame: ThumbnailFrame;
}

/** Bucket width for sampled frames. Netflix's BIF spacing is ~10s. */
const BUCKET_SECONDS = 10;
/** Cap the cache so a long scrub cannot leak hundreds of blobs. */
const MAX_SAMPLES = 60;

function parseTimestamp(value: string): number {
  // 00:01:23.456 | 01:23.456
  const parts = value.trim().split(':').map(Number);
  if (parts.some((n) => Number.isNaN(n))) return NaN;
  if (parts.length === 3) return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  if (parts.length === 2) return parts[0]! * 60 + parts[1]!;
  return parts[0] ?? NaN;
}

/** Parse a thumbnail WebVTT file into cues with resolved absolute URLs. */
export function parseThumbnailVtt(text: string, baseUrl: string): VttThumbCue[] {
  const cues: VttThumbCue[] = [];
  const blocks = text.replace(/\r/g, '').split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split('\n').filter(Boolean);
    const timingIndex = lines.findIndex((l) => l.includes('-->'));
    if (timingIndex === -1) continue;
    const [rawStart, rawEnd] = lines[timingIndex]!.split('-->');
    const start = parseTimestamp(rawStart ?? '');
    const end = parseTimestamp((rawEnd ?? '').split(/\s+/)[0] ?? '');
    const payload = lines[timingIndex + 1]?.trim();
    if (!payload || Number.isNaN(start) || Number.isNaN(end)) continue;

    const [path, fragment] = payload.split('#');
    let x = 0;
    let y = 0;
    let w = 0;
    let h = 0;
    const xywh = fragment?.match(/xywh=(?:pixel:)?(-?\d+),(-?\d+),(\d+),(\d+)/);
    if (xywh) {
      x = Number(xywh[1]);
      y = Number(xywh[2]);
      w = Number(xywh[3]);
      h = Number(xywh[4]);
    }
    let url = path ?? '';
    try {
      url = new URL(url, baseUrl).toString();
    } catch {
      /* relative resolution failed — use the raw value */
    }
    cues.push({ start, end, frame: { url, x, y, w, h } });
  }
  return cues.sort((a, b) => a.start - b.start);
}

export class ThumbnailProvider {
  private cues: VttThumbCue[] = [];
  private samples = new Map<number, ThumbnailFrame>();
  private pending = new Set<number>();
  private sampler: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private destroyed = false;
  /** Sampling is impossible (tainted canvas / decode failure) — stop trying. */
  private samplingBlocked = false;

  constructor(
    private readonly mediaSrc: string,
    private readonly crossOrigin: string | undefined,
    private readonly canSample: boolean
  ) {}

  /** Load a VTT thumbnail track, if the source has one. */
  async loadVtt(vttUrl: string): Promise<boolean> {
    try {
      const res = await fetch(vttUrl);
      if (!res.ok) return false;
      const text = await res.text();
      if (this.destroyed) return false;
      this.cues = parseThumbnailVtt(text, vttUrl);
      return this.cues.length > 0;
    } catch {
      return false; // no preview is a soft failure, never an error state
    }
  }

  /** True when previews are possible at all — drives the `thumbnails` cap. */
  get available(): boolean {
    return this.cues.length > 0 || (this.canSample && !this.samplingBlocked);
  }

  /** Best frame for `seconds`, scheduling a sample when one is missing. */
  at(seconds: number): ThumbnailFrame | null {
    if (this.cues.length > 0) {
      // Binary search would be overkill: trick-play tracks are a few hundred
      // cues and this runs at pointer-move rate on an already-parsed array.
      const cue =
        this.cues.find((c) => seconds >= c.start && seconds < c.end) ??
        (seconds >= (this.cues.at(-1)?.start ?? 0) ? this.cues.at(-1) : this.cues[0]);
      return cue?.frame ?? null;
    }
    if (!this.canSample || this.samplingBlocked) return null;

    const bucket = Math.max(0, Math.floor(seconds / BUCKET_SECONDS));
    const exact = this.samples.get(bucket);
    if (exact) return exact;
    void this.sample(bucket);

    // Show the nearest already-sampled bucket so the tooltip is never empty
    // mid-drag; it is replaced as soon as the real frame decodes.
    let best: ThumbnailFrame | null = null;
    let bestDistance = Infinity;
    for (const [key, frame] of this.samples) {
      const distance = Math.abs(key - bucket);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = frame;
      }
    }
    return best;
  }

  private ensureSampler(): HTMLVideoElement | null {
    if (this.sampler || this.destroyed) return this.sampler;
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'auto';
    video.playsInline = true;
    if (this.crossOrigin) video.crossOrigin = this.crossOrigin;
    video.src = this.mediaSrc;
    // Off-screen but still in the document: some browsers refuse to decode a
    // detached element.
    video.style.cssText =
      'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px;top:0';
    document.body.appendChild(video);
    this.sampler = video;
    return video;
  }

  private async sample(bucket: number): Promise<void> {
    if (this.pending.has(bucket) || this.samplingBlocked || this.destroyed) return;
    this.pending.add(bucket);
    try {
      const video = this.ensureSampler();
      if (!video) return;
      const time = bucket * BUCKET_SECONDS + BUCKET_SECONDS / 2;

      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error('seek timeout')), 4000);
        const done = () => {
          window.clearTimeout(timer);
          video.removeEventListener('seeked', done);
          video.removeEventListener('error', fail);
          resolve();
        };
        const fail = () => {
          window.clearTimeout(timer);
          video.removeEventListener('seeked', done);
          video.removeEventListener('error', fail);
          reject(new Error('sampler error'));
        };
        video.addEventListener('seeked', done, { once: true });
        video.addEventListener('error', fail, { once: true });
        try {
          video.currentTime = time;
        } catch {
          fail();
        }
      });

      if (this.destroyed) return;
      const width = 240;
      const ratio = video.videoHeight && video.videoWidth ? video.videoHeight / video.videoWidth : 9 / 16;
      const height = Math.round(width * ratio);
      const canvas = (this.canvas ??= document.createElement('canvas'));
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      // Throws a SecurityError for cross-origin media without CORS headers —
      // that is permanent, so sampling is disabled rather than retried.
      ctx.drawImage(video, 0, 0, width, height);
      const url = canvas.toDataURL('image/jpeg', 0.6);

      if (this.samples.size >= MAX_SAMPLES) {
        const oldest = this.samples.keys().next().value;
        if (oldest !== undefined) this.samples.delete(oldest);
      }
      this.samples.set(bucket, { url, x: 0, y: 0, w: width, h: height });
    } catch {
      this.samplingBlocked = true;
      this.teardownSampler();
    } finally {
      this.pending.delete(bucket);
    }
  }

  private teardownSampler(): void {
    if (this.sampler) {
      this.sampler.removeAttribute('src');
      this.sampler.load();
      this.sampler.remove();
      this.sampler = null;
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.teardownSampler();
    this.samples.clear();
    this.cues = [];
    this.canvas = null;
  }
}
