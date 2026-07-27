// src/components/react/player/EndCard.tsx — what the screen shows after the last frame.
//
// Netflix never leaves a black rectangle at the end: it offers the next thing.
// This card is only rendered when the engine has a trustworthy `ended` signal
// (`caps.endedSignal`), so it can never appear over a still-playing video.
//
// Order of actions is deliberate: the primary action is whatever continues the
// session (next episode if there is one, otherwise replay), because that is what
// the viewer is most likely to want, and it receives initial focus.

import { useEffect, useRef } from 'react';
import { NextIcon, ReplayIcon } from './Icons';
import type { PlayerT } from '../../../lib/player/strings';

export interface RelatedTitle {
  id: number;
  title: string;
  posterUrl: string | null;
  href: string;
}

interface EndCardProps {
  title: string;
  /** Present for series when a following episode exists. */
  next?: { eyebrow: string; title: string; onPlay: () => void } | null;
  onReplay: () => void;
  related: RelatedTitle[];
  t: PlayerT;
}

export default function EndCard({ title, next, onReplay, related, t }: EndCardProps) {
  const primaryRef = useRef<HTMLButtonElement>(null);

  // Focus the primary action so keyboard and switch-access users can continue
  // without hunting; the video is over, so stealing focus here is expected.
  useEffect(() => {
    primaryRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="fp-endcard" role="group" aria-label={`${title} — ${t('stateEnded')}`}>
      <div className="fp-endcard-actions">
        {next ? (
          <>
            <button ref={primaryRef} type="button" className="fp-endcard-primary" onClick={next.onPlay}>
              <NextIcon size={20} />
              <span className="fp-endcard-primary-text">
                <span className="fp-endcard-eyebrow">
                  {t('upNext')} · {next.eyebrow}
                </span>
                <span>{next.title}</span>
              </span>
            </button>
            <button type="button" className="fp-endcard-secondary" onClick={onReplay}>
              <ReplayIcon size={18} />
              <span>{t('watchAgain')}</span>
            </button>
          </>
        ) : (
          <button ref={primaryRef} type="button" className="fp-endcard-primary" onClick={onReplay}>
            <ReplayIcon size={20} />
            <span className="fp-endcard-primary-text">
              <span>{t('watchAgain')}</span>
            </span>
          </button>
        )}
      </div>

      {related.length > 0 && (
        <section className="fp-endcard-related" aria-label={t('relatedTitles')}>
          <h3 className="fp-endcard-related-title">{t('relatedTitles')}</h3>
          <ul className="fp-endcard-grid">
            {related.slice(0, 6).map((item) => (
              <li key={item.id}>
                {/* data-fp-passthrough: the ONE place player chrome deliberately
                    talks to the page. The stage contains every other pointer
                    event (see PlayerShell.containPointer); these links must reach
                    Astro's document-level ClientRouter so navigating to another
                    title is a view transition, not a full reload. */}
                <a className="fp-endcard-card" href={item.href} data-fp-passthrough>
                  {item.posterUrl ? (
                    <img src={item.posterUrl} alt="" loading="lazy" />
                  ) : (
                    <span className="fp-endcard-card-fallback" aria-hidden="true" />
                  )}
                  <span className="fp-endcard-card-title">{item.title}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
