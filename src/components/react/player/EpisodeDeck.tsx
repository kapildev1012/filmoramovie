// src/components/react/player/EpisodeDeck.tsx — phone episode picker.
//
// The stagger-deck interaction (see components/ui/stagger-testimonials.tsx)
// applied to a season's episodes: one lifted card in the centre, its neighbours
// clipped, rotated and dimmed behind it, moved by swiping, tapping a neighbour
// or using the chevrons.
//
// WHY A DECK ON PHONES
// The vertical list is the right shape on a wide screen, where the container
// query gives it two or three columns. On a 390px phone it becomes a tall stack
// of near-identical rows that pushes everything below the player off-screen —
// 24 episodes is 24 scrolls of thumbnail. The deck is a fixed-height object:
// one episode is the subject, the rest are clearly *there* without costing any
// page height.
//
// INTERACTION
//   • centre card  → plays that episode
//   • other card   → brings it to the centre (steps = its position)
//   • swipe / arrow keys / chevrons → move one step
//
// Only the centre card is reachable by keyboard (`tabIndex -1` elsewhere) and
// only it is exposed to assistive tech; the chevrons are the accessible way to
// move, and the counter is a live region so the new centre is announced.

import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PlayIcon } from './Icons';
import type { EpisodeItem } from './EpisodeOverlay';
import type { PlayerT } from '../../../lib/player/strings';

const STILL = 'https://image.tmdb.org/t/p/w300';

/** Cards further out than this from the centre are not rendered at all. */
const WINDOW = 3;
/** …and only these carry an <img>, so a 24-episode season loads ~5 stills. */
const IMAGE_WINDOW = 2;
/** Horizontal travel needed before a touch counts as a swipe, not a tap. */
const SWIPE_PX = 36;

interface DeckCard {
  key: string;
  episode: EpisodeItem;
}

export interface EpisodeDeckProps {
  season: number;
  episodes: EpisodeItem[];
  current: { season: number; episode: number } | null;
  onPlay: (season: number, episode: number) => void;
  t: PlayerT;
}

/** Rotate `list` left by `count`, wrapping. */
function rotate<T>(list: T[], count: number): T[] {
  if (list.length === 0) return list;
  const offset = ((count % list.length) + list.length) % list.length;
  return [...list.slice(offset), ...list.slice(0, offset)];
}

export default function EpisodeDeck({
  season,
  episodes,
  current,
  onPlay,
  t,
}: EpisodeDeckProps) {
  const [deck, setDeck] = useState<DeckCard[]>([]);
  /** Monotonic counter for the re-mount keys handleMove hands out. */
  const seq = useRef(0);

  const currentEpisode = current?.season === season ? current.episode : null;

  // Build (and re-centre) the deck. The episode being watched starts in the
  // middle, so a viewer 14 episodes deep does not open on episode 1.
  useEffect(() => {
    if (episodes.length === 0) {
      setDeck([]);
      return;
    }
    const cards: DeckCard[] = episodes.map((episode) => ({
      key: `s${season}e${episode.episode_number}`,
      episode,
    }));
    const centre = Math.floor(cards.length / 2);
    const target = currentEpisode
      ? cards.findIndex((card) => card.episode.episode_number === currentEpisode)
      : 0;
    setDeck(rotate(cards, (target < 0 ? 0 : target) - centre));
  }, [episodes, season, currentEpisode]);

  // Card width tracks the viewport so the neighbours always peek in by the same
  // amount, from a 320px phone up to the 40rem breakpoint where the list takes
  // over again.
  const [cardWidth, setCardWidth] = useState(240);
  useEffect(() => {
    const update = () => {
      setCardWidth(Math.max(196, Math.min(276, Math.round(window.innerWidth * 0.62))));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const cardHeight = Math.round(cardWidth * 1.26);
  const notch = Math.round(cardWidth * 0.15);

  const handleMove = useCallback((steps: number) => {
    if (steps === 0) return;
    setDeck((previous) => {
      if (previous.length < 2) return previous;
      const list = [...previous];
      // A card that wraps around gets a fresh key on purpose: it should appear
      // at its new edge rather than fly across the whole deck.
      if (steps > 0) {
        for (let i = steps; i > 0; i--) {
          const item = list.shift();
          if (!item) return previous;
          list.push({ ...item, key: `${item.key}#${++seq.current}` });
        }
      } else {
        for (let i = steps; i < 0; i++) {
          const item = list.pop();
          if (!item) return previous;
          list.unshift({ ...item, key: `${item.key}#${++seq.current}` });
        }
      }
      return list;
    });
  }, []);

  // ── Swipe ────────────────────────────────────────────────────────────────
  // `swiped` suppresses the click that follows a drag, so a swipe that ends over
  // the centre card does not also start playback.
  const touchX = useRef<number | null>(null);
  const swiped = useRef(false);

  const onTouchStart = (event: React.TouchEvent) => {
    touchX.current = event.touches[0]?.clientX ?? null;
    swiped.current = false;
  };
  const onTouchEnd = (event: React.TouchEvent) => {
    const start = touchX.current;
    touchX.current = null;
    if (start === null) return;
    const delta = (event.changedTouches[0]?.clientX ?? start) - start;
    if (Math.abs(delta) < SWIPE_PX) return;
    swiped.current = true;
    handleMove(delta < 0 ? 1 : -1);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      handleMove(1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      handleMove(-1);
    }
  };

  const centreIndex = Math.floor(deck.length / 2);
  const centreEpisode = deck[centreIndex]?.episode ?? null;

  const positionLabel = useMemo(() => {
    if (!centreEpisode) return '';
    const index = episodes.findIndex(
      (episode) => episode.episode_number === centreEpisode.episode_number
    );
    return `${index + 1} / ${episodes.length}`;
  }, [centreEpisode, episodes]);

  if (episodes.length === 0) return null;

  return (
    <div
      className="fp-epdeck"
      role="group"
      aria-roledescription="carousel"
      aria-label={t('episodes')}
      onKeyDown={onKeyDown}
    >
      <div
        className="fp-epdeck-stage"
        style={{ height: cardHeight + 40 }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {deck.map((card, index) => {
          const position = index - centreIndex;
          if (Math.abs(position) > WINDOW) return null;

          const distance = Math.abs(position);
          const isCentre = position === 0;
          const episode = card.episode;
          const isPlaying = currentEpisode === episode.episode_number;
          const odd = position % 2 !== 0;

          return (
            <button
              key={card.key}
              type="button"
              className={`fp-epcard${isCentre ? ' is-centre' : ''}${isPlaying ? ' is-playing' : ''}`}
              style={{
                width: cardWidth,
                height: cardHeight,
                zIndex: 10 - distance,
                opacity: isCentre ? 1 : Math.max(0.2, 0.6 - (distance - 1) * 0.2),
                clipPath: `polygon(${notch}px 0%, 100% 0%, 100% 100%, 0 100%, 0 ${notch}px)`,
                transform: [
                  'translate(-50%, -50%)',
                  `translateX(${(cardWidth / 1.5) * position}px)`,
                  `translateY(${isCentre ? -14 : odd ? 16 : -16}px)`,
                  `rotate(${isCentre ? 0 : odd ? 2.4 : -2.4}deg)`,
                  `scale(${isCentre ? 1 : 0.93})`,
                ].join(' '),
              }}
              onClick={() => {
                if (swiped.current) {
                  swiped.current = false;
                  return;
                }
                if (isCentre) onPlay(season, episode.episode_number);
                else handleMove(position);
              }}
              tabIndex={isCentre ? 0 : -1}
              aria-hidden={isCentre ? undefined : true}
              aria-current={isPlaying ? 'true' : undefined}
              aria-label={
                isCentre
                  ? `${t('play')} — ${t('episode')} ${episode.episode_number}: ${episode.name}`
                  : undefined
              }
            >
              {/* The hairline that finishes the clipped corner. */}
              <span
                className="fp-epcard-slash"
                aria-hidden="true"
                style={{ top: notch, width: Math.round(notch * Math.SQRT2) }}
              />

              <span className="fp-epcard-thumb">
                {episode.still_path && distance <= IMAGE_WINDOW ? (
                  <img src={`${STILL}${episode.still_path}`} alt="" loading="lazy" decoding="async" />
                ) : (
                  <span className="fp-epcard-thumb-fallback" aria-hidden="true">
                    {episode.episode_number}
                  </span>
                )}
                {isCentre && (
                  <span className="fp-epcard-play" aria-hidden="true">
                    <PlayIcon size={20} />
                  </span>
                )}
              </span>

              <span className="fp-epcard-body">
                <span className="fp-epcard-num">
                  {`S${season} · ${t('episode')} ${episode.episode_number}`}
                  {episode.runtime ? ` · ${episode.runtime}m` : ''}
                </span>
                <span className="fp-epcard-name">{episode.name}</span>
                {isCentre && episode.overview && (
                  <span className="fp-epcard-overview">{episode.overview}</span>
                )}
              </span>

              {isPlaying && <span className="fp-epcard-flag">{t('statePlaying')}</span>}
            </button>
          );
        })}
      </div>

      <div className="fp-epdeck-nav">
        <button
          type="button"
          className="fp-epdeck-arrow"
          onClick={() => handleMove(-1)}
          aria-label={t('prevEpisode')}
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <span className="fp-epdeck-count" aria-live="polite">
          {centreEpisode ? (
            <>
              <strong>
                {t('episode')} {centreEpisode.episode_number}
              </strong>
              <span aria-hidden="true"> · {positionLabel}</span>
            </>
          ) : null}
        </span>
        <button
          type="button"
          className="fp-epdeck-arrow"
          onClick={() => handleMove(1)}
          aria-label={t('nextEpisode')}
        >
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
