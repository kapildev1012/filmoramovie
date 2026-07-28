// src/components/react/player/StaggerEpisodes.tsx — mobile episode card stack.
//
// A staggered, swipeable card carousel for picking an episode on a phone,
// adapted from the "stagger testimonials" pattern. It is the MOBILE presentation
// of the inline episode browser only — the scannable list (EpisodeOverlay's <ul>)
// stays on tablet/desktop where a whole season fits on screen at once.
//
// WHY THIS EXISTS / TRADE-OFFS
// A rotated one-at-a-time card stack looks great but is weaker for scanning a
// long season, so the interaction is built to stay usable at any episode count:
//   • it is seeded to the episode you are watching (not episode 1),
//   • side cards are tappable to bring them to the centre,
//   • the centre card is the "play this" target, with an explicit Play chip,
//   • prev / next chevrons and horizontal swipe both step through the season,
//   • a "Episode X of N" caption keeps your position legible.
//
// STYLING
// Fully self-contained (inline styles + a scoped <style> block) using the global
// `--color-*` tokens, because the inline episode browser renders OUTSIDE
// `.fp-root` — the player-local `--fp-*` tokens are not in scope here.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PlayIcon } from './Icons';
import type { EpisodeItem } from './EpisodeOverlay';
import type { PlayerT } from '../../../lib/player/strings';

const STILL = 'https://image.tmdb.org/t/p/w300';
/** How many cards to each side of the centre are mounted (perf on long seasons). */
const WINDOW = 2;

interface Props {
  episodes: EpisodeItem[];
  activeSeason: number;
  current: { season: number; episode: number } | null;
  onPlay: (season: number, episode: number) => void;
  t: PlayerT;
}

export default function StaggerEpisodes({
  episodes,
  activeSeason,
  current,
  onPlay,
  t,
}: Props) {
  const [cardSize, setCardSize] = useState(260);
  const [center, setCenter] = useState(0);
  const touchStartX = useRef<number | null>(null);

  // Seed (and re-seed on season / list change) to the episode being watched, so
  // a viewer 12 episodes deep does not land back on episode 1.
  useEffect(() => {
    if (episodes.length === 0) return;
    const watchingIndex =
      current && current.season === activeSeason
        ? episodes.findIndex((e) => e.episode_number === current.episode)
        : -1;
    setCenter(watchingIndex >= 0 ? watchingIndex : 0);
  }, [episodes, activeSeason, current]);

  // Larger cards once there is room for them (matches the reference breakpoint).
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia('(min-width: 400px)');
    const sync = () => setCardSize(query.matches ? 292 : 256);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  const move = useCallback(
    (steps: number) => {
      setCenter((prev) => {
        const next = prev + steps;
        if (next < 0) return 0;
        if (next > episodes.length - 1) return episodes.length - 1;
        return next;
      });
    },
    [episodes.length]
  );

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) move(dx < 0 ? 1 : -1); // swipe left → next
    touchStartX.current = null;
  };

  const lift = Math.round(cardSize * 0.16);
  // Cards are portrait 8:12 (= 2:3, width : height) on mobile.
  const cardHeight = Math.round((cardSize * 12) / 8);
  // Room for the lifted centre card + rotation of the neighbours + controls.
  const stageHeight = cardHeight + 132;

  const windowed = useMemo(
    () =>
      episodes
        .map((episode, index) => ({ episode, index, position: index - center }))
        .filter((item) => Math.abs(item.position) <= WINDOW),
    [episodes, center]
  );

  if (episodes.length === 0) return null;

  return (
    <div
      className="fp-stagger"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      role="group"
      aria-roledescription="carousel"
      aria-label={t('episodes')}
    >
      <div className="fp-stagger-stage" style={{ height: stageHeight }}>
        {windowed.map(({ episode, index, position }) => {
          const isCenter = position === 0;
          const isWatching =
            current?.season === activeSeason && current?.episode === episode.episode_number;
          return (
            <button
              type="button"
              key={episode.episode_number}
              className={`fp-stagger-card${isCenter ? ' is-center' : ''}`}
              aria-current={isWatching ? 'true' : undefined}
              aria-hidden={!isCenter}
              tabIndex={isCenter ? 0 : -1}
              onClick={() =>
                isCenter ? onPlay(activeSeason, episode.episode_number) : move(position)
              }
              style={{
                width: cardSize,
                height: cardHeight,
                zIndex: 20 - Math.abs(position),
                transform: `translate(-50%, -50%) translateX(${(cardSize / 1.55) * position}px) translateY(${
                  isCenter ? -lift : position % 2 ? 16 : -16
                }px) rotate(${isCenter ? 0 : position % 2 ? 2.4 : -2.4}deg)`,
              }}
            >
              <span className="fp-stagger-thumb">
                {episode.still_path ? (
                  <img src={`${STILL}${episode.still_path}`} alt="" loading="lazy" decoding="async" />
                ) : (
                  <span className="fp-stagger-thumb-fallback" aria-hidden="true" />
                )}
                {isWatching && <span className="fp-stagger-badge">{t('statePlaying')}</span>}
                {isCenter && (
                  <span className="fp-stagger-play" aria-hidden="true">
                    <PlayIcon size={20} />
                  </span>
                )}
              </span>
              <span className="fp-stagger-num">
                {t('episode')} {episode.episode_number}
                {episode.runtime ? ` · ${episode.runtime}m` : ''}
              </span>
              <span className="fp-stagger-name">{episode.name}</span>
              {isCenter && episode.overview && (
                <span className="fp-stagger-overview">{episode.overview}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="fp-stagger-controls">
        <button
          type="button"
          className="fp-stagger-nav"
          onClick={() => move(-1)}
          disabled={center === 0}
          aria-label={t('prevEpisode')}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <span className="fp-stagger-count" aria-live="polite">
          {t('episode')} {episodes[center]?.episode_number ?? center + 1} / {episodes.length}
        </span>
        <button
          type="button"
          className="fp-stagger-nav"
          onClick={() => move(1)}
          disabled={center >= episodes.length - 1}
          aria-label={t('nextEpisode')}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
        </button>
      </div>

      <style>{`
        .fp-stagger {
          width: 100%;
          touch-action: pan-y;
          user-select: none;
          -webkit-user-select: none;
        }
        .fp-stagger-stage {
          position: relative;
          width: 100%;
          overflow: hidden;
        }
        .fp-stagger-card {
          position: absolute;
          left: 50%;
          top: 50%;
          display: flex;
          flex-direction: column;
          margin: 0;
          padding: 0.85rem;
          text-align: left;
          cursor: pointer;
          border-radius: 34px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(18, 18, 20, 0.42);
          -webkit-backdrop-filter: blur(12px) saturate(150%);
          backdrop-filter: blur(12px) saturate(150%);
          color: var(--color-text, #ededed);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);
          transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1),
                      background 0.4s ease, border-color 0.4s ease, box-shadow 0.4s ease;
          will-change: transform;
        }
        /* Dark, transparent "Apple crystal" centre card — a smoked-glass surface
           with heavier backdrop blur and bright inset edge highlights. */
        .fp-stagger-card.is-center {
          border-color: rgba(255, 255, 255, 0.22);
          background: rgba(10, 10, 12, 0.4);
          -webkit-backdrop-filter: blur(22px) saturate(180%);
          backdrop-filter: blur(22px) saturate(180%);
          color: #fff;
          box-shadow:
            0 18px 40px rgba(0, 0, 0, 0.6),
            inset 1px 1px 1px -0.5px rgba(255, 255, 255, 0.55),
            inset -1px -1px 1px -0.5px rgba(255, 255, 255, 0.35),
            inset 0 0 8px 6px rgba(255, 255, 255, 0.05),
            0 0 12px rgba(255, 255, 255, 0.08);
        }
        /* Graceful fallback where backdrop-filter is unsupported: a more opaque
           smoked panel so text stays legible over the video. */
        @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
          .fp-stagger-card { background: rgba(18, 18, 20, 0.9); }
          .fp-stagger-card.is-center { background: rgba(12, 12, 14, 0.82); }
        }
        .fp-stagger-card:not(.is-center) { opacity: 0.9; }
        .fp-stagger-card:focus-visible {
          outline: 3px solid var(--color-accent-to, #a142f4);
          outline-offset: 3px;
        }

        .fp-stagger-thumb {
          position: relative;
          display: block;
          width: 100%;
          flex: 1 1 auto;
          min-height: 0;
          margin-bottom: 0.6rem;
          border-radius: 18px;
          overflow: hidden;
          background: rgba(0, 0, 0, 0.35);
        }
        .fp-stagger-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .fp-stagger-thumb-fallback {
          display: block;
          width: 100%;
          height: 100%;
          background:
            repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0 10px, rgba(255,255,255,0.02) 10px 20px);
        }
        .fp-stagger-play {
          position: absolute;
          right: 0.5rem;
          bottom: 0.5rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 2.25rem;
          height: 2.25rem;
          border-radius: 999px;
          background: rgba(0, 0, 0, 0.55);
          color: #fff;
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
        }
        .fp-stagger-badge {
          position: absolute;
          left: 0.5rem;
          top: 0.5rem;
          padding: 0.15rem 0.45rem;
          border-radius: 999px;
          font-size: 0.6rem;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: #fff;
          background: var(--color-nf-red, #e50914);
        }

        .fp-stagger-num {
          display: block;
          flex: none;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          opacity: 0.85;
        }
        .fp-stagger-name {
          display: -webkit-box;
          flex: none;
          -webkit-line-clamp: 2;
          line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          margin-top: 0.15rem;
          font-size: 0.98rem;
          font-weight: 600;
          line-height: 1.25;
        }
        .fp-stagger-overview {
          display: -webkit-box;
          flex: none;
          -webkit-line-clamp: 3;
          line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
          margin-top: 0.4rem;
          font-size: 0.8rem;
          line-height: 1.4;
          color: rgba(255, 255, 255, 0.82);
        }

        .fp-stagger-controls {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          margin-top: 0.25rem;
        }
        .fp-stagger-nav {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 2.75rem;
          height: 2.75rem;
          border-radius: 999px;
          border: 1px solid var(--color-border, #1f1f1f);
          background: var(--color-surface, #0a0a0a);
          color: var(--color-text, #ededed);
          cursor: pointer;
          transition: background 0.18s ease, border-color 0.18s ease, opacity 0.18s ease;
        }
        .fp-stagger-nav:hover:not(:disabled) { border-color: var(--color-text-3, #666); }
        .fp-stagger-nav:disabled { opacity: 0.35; cursor: default; }
        .fp-stagger-nav:focus-visible {
          outline: 2px solid var(--color-accent-to, #a142f4);
          outline-offset: 2px;
        }
        .fp-stagger-count {
          min-width: 7rem;
          text-align: center;
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--color-text-2, #888);
          font-variant-numeric: tabular-nums;
        }

        @media (prefers-reduced-motion: reduce) {
          .fp-stagger-card { transition: none; }
        }
      `}</style>
    </div>
  );
}
