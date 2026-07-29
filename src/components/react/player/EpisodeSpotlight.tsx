// src/components/react/player/EpisodeSpotlight.tsx — episode presentation.
//
// An editorial "split" view of the active episode, adapted from the
// split-testimonial pattern: the episode's text sits on the left (an uppercase
// eyebrow with a hairline rule, a large light title, meta and overview), the
// still art sits on the right in a rounded framed card, and both fade/blur
// between episodes with framer-motion. A scrollable numbered strip below is the
// selector — it scales to a 24-episode season where the original's dot row
// would not.
//
// TWO SHAPES, ONE COMPONENT
// Phones (<40rem) and desktops (>=64rem) both get this; the caller hides it at
// tablet widths, where the container-query list has real columns and beats a
// one-at-a-time hero. Below `lg` the split becomes a stack — still on top, copy
// under it, a full-width Play button and 44px controls — and the still takes a
// horizontal swipe, which is the gesture the deck it replaced on phones taught.
//
// Selecting a chip *features* an episode (preview); the Play button and the
// artwork *play* it, so nothing auto-plays on a stray click.

import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, ChevronLeft, ChevronRight } from 'lucide-react';
import type { EpisodeItem } from './EpisodeOverlay';
import type { PlayerT } from '../../../lib/player/strings';

interface EpisodeSpotlightProps {
  episodes: EpisodeItem[];
  seasonNumber: number;
  current: { season: number; episode: number } | null;
  onPlay: (season: number, episode: number) => void;
  t: PlayerT;
}

const STILL_LG = 'https://image.tmdb.org/t/p/w780';
/** …and this one for the srcset, since the still is now ~480px wide on a
    1440px page, which a 780px file renders soft on a 2× screen. */
const STILL_XL = 'https://image.tmdb.org/t/p/w1280';
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
/** Horizontal travel on the still before a touch counts as a swipe, not a tap. */
const SWIPE_PX = 40;

export default function EpisodeSpotlight({
  episodes,
  seasonNumber,
  current,
  onPlay,
  t,
}: EpisodeSpotlightProps) {
  const [index, setIndex] = useState(0);
  const stripRef = useRef<HTMLDivElement>(null);

  // Feature the episode that is actually playing in this season.
  useEffect(() => {
    if (!current || current.season !== seasonNumber) return;
    const i = episodes.findIndex((e) => e.episode_number === current.episode);
    if (i >= 0) setIndex(i);
  }, [current, seasonNumber, episodes]);

  // Keep the pointer valid when the season (and so the list) changes.
  useEffect(() => {
    setIndex((i) => Math.min(i, Math.max(0, episodes.length - 1)));
  }, [episodes.length]);

  // Bring the featured chip into view as it moves.
  useEffect(() => {
    const strip = stripRef.current;
    const chip = strip?.querySelector<HTMLElement>('[data-active="true"]');
    chip?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [index]);

  if (episodes.length === 0) return null;
  const active = episodes[Math.min(index, episodes.length - 1)];
  if (!active) return null;

  const go = (delta: number) =>
    setIndex((i) => (i + delta + episodes.length) % episodes.length);
  const play = () => onPlay(seasonNumber, active.episode_number);
  const isCurrent =
    current?.season === seasonNumber && current?.episode === active.episode_number;

  // ── Swipe the still (phones) ─────────────────────────────────────────────
  // Left/right on the artwork features the next/previous episode. `swiped`
  // swallows the click that follows the drag, so a swipe never starts playback.
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
    go(delta < 0 ? 1 : -1);
  };
  const onArtClick = () => {
    if (swiped.current) {
      swiped.current = false;
      return;
    }
    play();
  };

  const meta = [
    active.runtime ? `${active.runtime}m` : null,
    active.air_date
      ? new Date(active.air_date).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : null,
  ]
    .filter(Boolean)
    .join('  ·  ');

  const title = active.name || `${t('episode')} ${active.episode_number}`;

  return (
    <div className="fp-ep-spotlight w-full">
      {/* Stacked below `lg`, split above it. The art column is a share of the
          width rather than a fixed 18rem: on a 1440px page the still used to be
          ~288px — a thumbnail next to a 30px title. Both columns use
          minmax(0, …) so a long overview shrinks instead of forcing the grid
          wider than the player. */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,44%)] lg:items-center lg:gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,48%)] xl:gap-10">
        {/* Episode copy. Second on a phone: the still is the thing worth leading
            with when there is no room for both side by side. */}
        <div className="order-2 min-w-0 space-y-3 lg:order-none lg:space-y-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={`eyebrow-${active.episode_number}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="inline-flex items-center gap-2 text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground lg:gap-3 lg:text-xs lg:tracking-[0.2em]"
            >
              <span className="h-px w-5 bg-muted-foreground/50 lg:w-8" />
              {t('season')} {seasonNumber} · {t('episode')} {active.episode_number}
            </motion.div>
          </AnimatePresence>

          <div className="relative overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.h3
                key={`title-${active.episode_number}`}
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -40 }}
                transition={{ duration: 0.5, ease: EASE }}
                className="m-0 text-xl font-light leading-tight tracking-tight text-foreground lg:text-3xl"
              >
                {title}
              </motion.h3>
            </AnimatePresence>
          </div>

          {meta && <p className="m-0 text-xs text-muted-foreground">{meta}</p>}

          {active.overview && (
            <div className="relative overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.p
                  key={`overview-${active.episode_number}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, delay: 0.15 }}
                  className="m-0 line-clamp-3 max-w-xl text-[0.8rem] leading-relaxed text-muted-foreground lg:text-sm"
                >
                  {active.overview}
                </motion.p>
              </AnimatePresence>
            </div>
          )}

          {/* Full width and 44px tall on a phone — it is the primary action and
              a phone has the room for it. */}
          <button
            type="button"
            onClick={play}
            className="inline-flex w-full min-h-11 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white lg:w-auto lg:min-h-0 lg:justify-start"
            style={{
              backgroundImage:
                'linear-gradient(135deg, var(--color-accent-from), var(--color-accent-to))',
            }}
          >
            <Play className="h-4 w-4 fill-current" />
            {t('play')}
            {isCurrent && <span className="opacity-80">· S{seasonNumber} E{active.episode_number}</span>}
          </button>
        </div>

        {/* Still art. `touch-action: pan-y` keeps the page scrollable while the
            horizontal swipe is ours. */}
        <div
          className="relative order-1 aspect-video w-full touch-pan-y lg:order-none"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <AnimatePresence mode="wait">
            <motion.button
              type="button"
              key={`art-${active.episode_number}`}
              onClick={onArtClick}
              aria-label={`${t('play')} ${title}`}
              initial={{ opacity: 0, filter: 'blur(20px)', scale: 1.05 }}
              animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
              exit={{ opacity: 0, filter: 'blur(20px)', scale: 0.95 }}
              transition={{ duration: 0.6, ease: EASE }}
              className="group absolute inset-0 overflow-hidden rounded-xl border border-border/60 lg:rounded-2xl"
            >
              {active.still_path ? (
                <img
                  src={`${STILL_LG}${active.still_path}`}
                  srcSet={`${STILL_LG}${active.still_path} 780w, ${STILL_XL}${active.still_path} 1280w`}
                  sizes="(min-width: 80rem) 48vw, (min-width: 64rem) 44vw, 100vw"
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-white/5" />
              )}
              {/* Hover reveal on a pointer device; on touch there is nothing to
                  hover, so the badge is simply always there. */}
              <span className="absolute inset-0 grid place-items-center bg-black/30 opacity-100 transition-opacity duration-200 lg:opacity-0 lg:group-hover:opacity-100">
                <span className="grid h-14 w-14 place-items-center rounded-full bg-white/15 backdrop-blur lg:h-16 lg:w-16">
                  <Play className="h-6 w-6 fill-current text-white" />
                </span>
              </span>
              {isCurrent && (
                <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-white">
                  {t('statePlaying')}
                </span>
              )}
            </motion.button>
          </AnimatePresence>
        </div>
      </div>

      {/* Selector strip: a scrollable row of episode numbers. This is what makes
          the hero usable on a phone — episode 20 of 23 is one tap away, where the
          deck this replaced needed twenty swipes. 44px targets below `lg`. */}
      <div className="mt-4 flex items-center gap-2 lg:mt-6">
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label={t('prevEpisode')}
          className="grid h-11 w-11 flex-none place-items-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground lg:h-9 lg:w-9"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div
          ref={stripRef}
          className="flex flex-1 gap-2 overflow-x-auto scroll-smooth py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {episodes.map((ep, i) => {
            const on = i === index;
            return (
              <button
                key={ep.episode_number}
                type="button"
                data-active={on || undefined}
                onClick={() => setIndex(i)}
                title={ep.name || `${t('episode')} ${ep.episode_number}`}
                className={`h-11 min-w-11 flex-none rounded-full px-3 text-sm font-semibold transition-all lg:h-9 lg:min-w-9 ${
                  on
                    ? 'text-white'
                    : 'border border-border/60 bg-white/[0.03] text-muted-foreground hover:border-foreground/30 hover:text-foreground'
                }`}
                style={
                  on
                    ? {
                        backgroundImage:
                          'linear-gradient(135deg, var(--color-accent-from), var(--color-accent-to))',
                        borderColor: 'transparent',
                      }
                    : undefined
                }
                aria-current={on ? 'true' : undefined}
              >
                {ep.episode_number}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => go(1)}
          aria-label={t('nextEpisode')}
          className="grid h-11 w-11 flex-none place-items-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground lg:h-9 lg:w-9"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
