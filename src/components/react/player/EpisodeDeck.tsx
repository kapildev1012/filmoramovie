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

/** Cards further out than this from the centre are not rendered at all.
    Two, not three: at three the card sits entirely outside the stage on every
    phone width, so it was markup and an opacity animation for nothing. */
const WINDOW = 2;
/** …and only these carry an <img>, so a 24-episode season loads ~5 stills. */
const IMAGE_WINDOW = 2;
/** Horizontal travel needed before a touch counts as a swipe, not a tap. */
const SWIPE_PX = 36;
/** Gap between card centres, as a fraction of one card width. Below 1 the
    neighbours overlap the centre card, which is what makes it read as a deck. */
const PEEK = 0.82;

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

  /* Does any episode in this season carry a synopsis? The deck has ONE height
     for every card, so the answer decides whether that height needs to reserve
     three lines of body copy or none — a season with no overviews used to get
     ~50px of empty card under every title. */
  const hasOverview = useMemo(
    () => episodes.some((episode) => !!episode.overview),
    [episodes]
  );

  /* Card geometry, measured from the DECK'S OWN WIDTH rather than the viewport.
     The episode block sits inside the page gutter, so on a 390px phone the stage
     is ~358px — sizing the card off `innerWidth` made it 85% of the stage, which
     left the neighbours as 20px scraps and put the card's edges exactly where the
     stage's edge fade starts.

     74% of the stage keeps a consistent ~13% peek on each side at every width.
     The height is ADDED UP from the parts that are really in the card — padding,
     a 16:9 still, the label, two lines of title, three lines of synopsis when the
     season has them — instead of the old `width * 1.14`, which over-shot the
     content by ~40px and left every card with a dead strip under its text. */
  const stageRef = useRef<HTMLDivElement>(null);
  const [geometry, setGeometry] = useState({ width: 260, height: 300 });
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const measure = () => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const stageWidth = stage.clientWidth || window.innerWidth;
      const width = Math.max(200, Math.min(320, Math.round(stageWidth * 0.74)));

      const padBlock = 0.85 * rem + 0.9 * rem; // .fp-epcard padding, top + bottom
      const padInline = 0.8 * rem * 2;
      const stackGap = 0.6 * rem; // thumb → body
      const bodyGap = 0.2 * rem * (hasOverview ? 2 : 1);
      const thumb = ((width - padInline) * 9) / 16;
      const label = 0.64 * rem * 1.4; // one uppercase line
      const title = 0.92 * rem * 1.28 * 2; // clamped to two lines
      const overview = hasOverview ? 0.73 * rem * 1.45 * 3 : 0; // clamped to three

      // Never let a card exceed ~62% of the viewport height: on a short phone in
      // landscape the deck would otherwise push the season pills out of reach.
      const height = Math.min(
        Math.round(padBlock + thumb + stackGap + label + title + overview + bodyGap),
        Math.round(window.innerHeight * 0.62)
      );

      // Bail out when nothing changed: the observer also fires for the height
      // this effect sets, and a fresh object every time would spin.
      setGeometry((previous) =>
        previous.width === width && previous.height === height ? previous : { width, height }
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    // The height cap depends on innerHeight, which a resize can change without
    // changing the stage's width.
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [hasOverview]);

  const { width: cardWidth, height: cardHeight } = geometry;
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
        ref={stageRef}
        style={{ height: cardHeight + 26 }}
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

          return (
            <button
              key={card.key}
              type="button"
              className={`fp-epcard${isCentre ? ' is-centre' : ''}${isPlaying ? ' is-playing' : ''}`}
              style={{
                width: cardWidth,
                height: cardHeight,
                zIndex: 10 - distance,
                /* The neighbours are backdrop, not content: dim enough that the
                   eye goes straight to the centre card, bright enough to read as
                   "there is more this way". */
                opacity: isCentre ? 1 : distance === 1 ? 0.5 : 0.22,
                clipPath: `polygon(${notch}px 0%, 100% 0%, 100% 100%, 0 100%, 0 ${notch}px)`,
                transform: [
                  'translate(-50%, -50%)',
                  `translateX(${cardWidth * PEEK * position}px)`,
                  /* Only the centre card lifts. The old alternating ±16px scatter
                     put one neighbour above the centre and the next below it,
                     which read as misalignment rather than as a stack. */
                  `translateY(${isCentre ? -10 : 0}px)`,
                  `rotate(${isCentre ? 0 : position < 0 ? -2.2 : 2.2}deg)`,
                  `scale(${isCentre ? 1 : distance === 1 ? 0.94 : 0.88})`,
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
                {/* On the neighbours too, not just the centre: every card is the
                    same height, so a card without its synopsis is a card with an
                    empty strip at the bottom. They are dimmed anyway. */}
                {episode.overview && (
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
