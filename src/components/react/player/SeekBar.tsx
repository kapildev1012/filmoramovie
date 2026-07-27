// src/components/react/player/SeekBar.tsx — scrub bar with preview + buffer.
//
// Behaviour notes worth keeping:
// • The bar is force-`dir="ltr"`. Time always runs left→right even in an RTL
//   page; letting the bar mirror would invert every drag for Arabic/Hebrew
//   viewers.
// • Pointer capture is taken on pointerdown, so a drag that leaves the bar (or
//   the window) still tracks and still commits — the classic "scrub off the edge
//   and the bar sticks" bug.
// • While dragging we do NOT seek on every move. The engine is seeked once on
//   release; during the drag only the preview moves. Seeking per pointermove
//   thrashes the decoder and makes HLS re-buffer for every pixel.
// • Read-only mode: when the engine reports time but cannot seek (a provider
//   that volunteers progress telemetry), the same bar renders with no handle,
//   no preview and `aria-readonly`, instead of a control that lies.
// • Hit area is 20px tall on touch (the visible track is 4px) so the thumb is
//   grabbable without a stylus, while the painted bar stays thin.

import { useCallback, useMemo, useRef, useState } from 'react';
import type { BufferedRange, TimeMarker } from '../../../lib/player/types';
import { formatTime, spokenTime } from '../../../lib/player/format';
import type { PlayerT } from '../../../lib/player/strings';

interface SeekBarProps {
  currentTime: number;
  duration: number;
  buffered: BufferedRange[];
  seekable: boolean;
  markers: TimeMarker[];
  /** Position currently being previewed (null when not scrubbing). */
  scrubTime: number | null;
  onScrub: (seconds: number | null) => void;
  onCommit: (seconds: number) => void;
  onNudge: (delta: number) => void;
  thumbnailAt: (seconds: number) => { url: string; x: number; y: number; w: number; h: number } | null;
  t: PlayerT;
}

/** Preview card width; the tooltip is clamped to stay inside the bar. */
const PREVIEW_WIDTH = 168;

export default function SeekBar({
  currentTime,
  duration,
  buffered,
  seekable,
  markers,
  scrubTime,
  onScrub,
  onCommit,
  onNudge,
  thumbnailAt,
  t,
}: SeekBarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  const safeDuration = duration > 0 ? duration : 0;
  const displayTime = scrubTime ?? currentTime;
  const progress = safeDuration > 0 ? Math.min(1, Math.max(0, displayTime / safeDuration)) : 0;

  /** Furthest buffered edge that is contiguous with the playhead. */
  const bufferedEnd = useMemo(() => {
    if (safeDuration <= 0) return 0;
    const range = buffered.find((r) => currentTime >= r.start - 0.5 && currentTime <= r.end);
    return range ? Math.min(1, range.end / safeDuration) : 0;
  }, [buffered, currentTime, safeDuration]);

  const timeFromEvent = useCallback(
    (clientX: number): number => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0 || safeDuration <= 0) return 0;
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return ratio * safeDuration;
    },
    [safeDuration]
  );

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!seekable || safeDuration <= 0) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      draggingRef.current = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      onScrub(timeFromEvent(event.clientX));
      event.preventDefault();
    },
    [seekable, safeDuration, onScrub, timeFromEvent]
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!seekable || safeDuration <= 0) return;
      const time = timeFromEvent(event.clientX);
      if (draggingRef.current) {
        onScrub(time);
        event.preventDefault();
      } else if (event.pointerType !== 'touch') {
        // Hover preview is a pointer-fine affordance; on touch the preview only
        // appears once a drag starts, so a tap does not flash a tooltip.
        setHoverTime(time);
      }
    },
    [seekable, safeDuration, onScrub, timeFromEvent]
  );

  const endDrag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      const time = timeFromEvent(event.clientX);
      onScrub(null);
      onCommit(time);
    },
    [onCommit, onScrub, timeFromEvent]
  );

  /**
   * The bar is its own slider widget: it handles the arrow keys itself and stops
   * propagation so the stage's global shortcut handler does not also seek (which
   * would move the playhead 20s per press).
   */
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!seekable || safeDuration <= 0) return;
      const step = event.shiftKey ? 30 : 10;
      let handled = true;
      switch (event.key) {
        case 'ArrowRight':
          onNudge(step);
          break;
        case 'ArrowLeft':
          onNudge(-step);
          break;
        case 'PageUp':
          onNudge(60);
          break;
        case 'PageDown':
          onNudge(-60);
          break;
        case 'Home':
          onCommit(0);
          break;
        case 'End':
          onCommit(Math.max(0, safeDuration - 1));
          break;
        default:
          handled = false;
      }
      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    [seekable, safeDuration, onNudge, onCommit]
  );

  const previewTime = scrubTime ?? hoverTime;
  const showPreview = seekable && previewTime !== null && safeDuration > 0;
  const frame = showPreview ? thumbnailAt(previewTime) : null;

  // Clamp the preview inside the track so it never hangs off the viewport.
  const previewLeft = (() => {
    const width = trackRef.current?.clientWidth ?? 0;
    if (!width || previewTime === null) return 0;
    const raw = (previewTime / safeDuration) * width;
    return Math.min(Math.max(raw, PREVIEW_WIDTH / 2), width - PREVIEW_WIDTH / 2);
  })();

  return (
    <div className="fp-seek" dir="ltr">
      {showPreview && (
        <div
          className="fp-seek-preview"
          style={{ left: `${previewLeft}px` }}
          aria-hidden="true"
        >
          {frame && (
            <span
              className="fp-seek-preview-img"
              style={{
                backgroundImage: `url(${frame.url})`,
                // Sprite sheets need an offset + intrinsic size; standalone
                // frames report w/h and a zero offset, so one formula covers both.
                backgroundPosition: `-${frame.x}px -${frame.y}px`,
                backgroundSize: frame.x || frame.y ? 'auto' : 'cover',
                aspectRatio: frame.w && frame.h ? `${frame.w} / ${frame.h}` : '16 / 9',
              }}
            />
          )}
          <span className="fp-seek-preview-time">{formatTime(previewTime)}</span>
        </div>
      )}

      <div
        ref={trackRef}
        className={`fp-seek-track${seekable ? '' : ' is-readonly'}`}
        role="slider"
        tabIndex={seekable ? 0 : -1}
        aria-label={t('seek')}
        aria-valuemin={0}
        aria-valuemax={Math.max(0, Math.round(safeDuration))}
        aria-valuenow={Math.round(displayTime)}
        // Screen readers read "1:05:09" as digits; a spoken form is clearer.
        aria-valuetext={`${spokenTime(displayTime)} / ${spokenTime(safeDuration)}`}
        aria-readonly={!seekable}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={() => setHoverTime(null)}
        onKeyDown={onKeyDown}
      >
        <span className="fp-seek-rail" />
        <span className="fp-seek-buffer" style={{ transform: `scaleX(${bufferedEnd})` }} />
        <span className="fp-seek-played" style={{ transform: `scaleX(${progress})` }} />

        {/* Chapter markers (intro / recap / credits) as notches on the rail. */}
        {safeDuration > 0 &&
          markers.map((m) => (
            <span
              key={`${m.kind}-${m.start}`}
              className={`fp-seek-marker fp-seek-marker-${m.kind}`}
              style={{
                left: `${(m.start / safeDuration) * 100}%`,
                width: `${Math.max(0.4, ((m.end - m.start) / safeDuration) * 100)}%`,
              }}
              aria-hidden="true"
            />
          ))}

        {seekable && <span className="fp-seek-handle" style={{ left: `${progress * 100}%` }} />}
      </div>
    </div>
  );
}
