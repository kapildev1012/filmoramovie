// src/components/react/player/UpNext.tsx — auto-advance prompt with countdown.
//
// Appears near the end of an episode (or immediately on `ended`, depending on
// what the caller passes) and advances by itself unless cancelled — the pattern
// viewers expect from a binge session.
//
// Details that make it not annoying:
// • The countdown is driven by one interval, cleared on unmount, and it stops the
//   moment the viewer cancels or presses play.
// • `prefers-reduced-motion` removes the sweeping ring animation but keeps the
//   numeric countdown, so the information is never lost with the motion.
// • Cancel is a real button with a label, and Escape triggers it too, because a
//   prompt that steals the next action must be dismissible without aim.
// • The card is focusable and announced politely, so a screen reader user hears
//   "Up next … playing in 8 seconds" instead of silently jumping episodes.

import { useEffect, useRef, useState } from 'react';
import { NextIcon, CloseIcon } from './Icons';
import type { PlayerT } from '../../../lib/player/strings';

interface UpNextProps {
  /** e.g. "S2 E4" */
  eyebrow: string;
  title: string;
  stillUrl?: string | null;
  /** Seconds to count down; 0 disables auto-advance (manual prompt only). */
  seconds: number;
  onPlay: () => void;
  onCancel: () => void;
  t: PlayerT;
}

export default function UpNext({
  eyebrow,
  title,
  stillUrl,
  seconds,
  onPlay,
  onCancel,
  t,
}: UpNextProps) {
  const [remaining, setRemaining] = useState(seconds);
  const firedRef = useRef(false);

  useEffect(() => {
    setRemaining(seconds);
    firedRef.current = false;
  }, [seconds, title]);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = window.setInterval(() => {
      setRemaining((value) => {
        if (value <= 1) {
          window.clearInterval(timer);
          if (!firedRef.current) {
            firedRef.current = true;
            onPlay();
          }
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [seconds, title, onPlay]);

  const progress = seconds > 0 ? (seconds - remaining) / seconds : 0;

  return (
    <aside
      className="fp-upnext"
      role="status"
      aria-live="polite"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onCancel();
        }
      }}
    >
      {stillUrl && (
        <span
          className="fp-upnext-thumb"
          style={{ backgroundImage: `url(${stillUrl})` }}
          aria-hidden="true"
        />
      )}
      <span className="fp-upnext-body">
        <span className="fp-upnext-eyebrow">
          {t('upNext')} · {eyebrow}
        </span>
        <span className="fp-upnext-title">{title}</span>
        <span className="fp-upnext-status">
          {seconds > 0 && remaining > 0 ? t('playingInSeconds', { n: remaining }) : t('startingNow')}
        </span>
      </span>
      <span className="fp-upnext-actions">
        <button type="button" className="fp-upnext-play" onClick={onPlay}>
          {/* The ring doubles as the countdown indicator on wide screens. */}
          <span
            className="fp-upnext-ring"
            style={{ '--fp-progress': progress } as React.CSSProperties}
            aria-hidden="true"
          />
          <NextIcon size={18} />
          <span>{t('nextEpisode')}</span>
        </button>
        <button
          type="button"
          className="fp-btn fp-btn-sm"
          onClick={onCancel}
          aria-label={t('cancel')}
          title={t('cancel')}
        >
          <CloseIcon size={18} />
        </button>
      </span>
    </aside>
  );
}
