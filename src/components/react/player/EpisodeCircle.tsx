// src/components/react/player/EpisodeCircle.tsx — phone episode picker.
//
// The circular-testimonials mechanic applied to episodes: the featured still sits
// flat and centred, the previous and next episodes fan out behind it — lifted,
// scaled to 0.85 and rotated on Y — and every other episode is faded out. The
// transform math is imported from ui/circular-testimonials so the two stay in
// step; only the content differs.
//
// WHAT THIS REPLACES
// EpisodeSpotlight was the phone shape as well as the desktop one. It still owns
// >=64rem; below 40rem this takes over. Both ship in the DOM and player.css
// picks one, so hydration never flashes the wrong layout.
//
// TWO THINGS THE UPSTREAM DESIGN DOES NOT HAVE, kept from EpisodeSpotlight
// because dropping them would be a regression on a phone:
//   • A Play action distinct from selection. Tapping a *neighbour* features it;
//     tapping the *centre* card plays it. Nothing auto-plays on a stray tap.
//   • The numbered strip. Arrows alone mean episode 20 of 23 is twenty taps
//     away; the strip makes it one.
//
// Autoplay is deliberately off. Artwork that rotates itself every 5s while a
// viewer is reading an episode synopsis is hostile, and this sits directly under
// a video that may be playing.

import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, ArrowLeft, ArrowRight } from 'lucide-react';
import { getStackStyle } from '../../ui/circular-testimonials';
import type { EpisodeItem } from './EpisodeOverlay';
import type { PlayerT } from '../../../lib/player/strings';

interface EpisodeCircleProps {
  episodes: EpisodeItem[];
  seasonNumber: number;
  current: { season: number; episode: number } | null;
  onPlay: (season: number, episode: number) => void;
  t: PlayerT;
}

const STILL = 'https://image.tmdb.org/t/p/w500';
const STILL_LG = 'https://image.tmdb.org/t/p/w780';
/** Horizontal travel before a touch counts as a swipe rather than a tap. */
const SWIPE_PX = 40;

export default function EpisodeCircle({
  episodes,
  seasonNumber,
  current,
  onPlay,
  t,
}: EpisodeCircleProps) {
  const [index, setIndex] = useState(0);
  const [trackWidth, setTrackWidth] = useState(320);
  const trackRef = useRef<HTMLDivElement>(null);
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

  // Measure the track, not the window: the fan offset is a function of the space
  // the cards actually have.
  useEffect(() => {
    const measure = () => {
      if (trackRef.current) setTrackWidth(trackRef.current.offsetWidth);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Bring the featured chip into view as it moves.
  useEffect(() => {
    const chip = stripRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    chip?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [index]);

  if (episodes.length === 0) return null;
  const active = episodes[Math.min(index, episodes.length - 1)];
  if (!active) return null;

  const total = episodes.length;
  const go = (delta: number) => setIndex((i) => (i + delta + total) % total);
  const play = (episodeNumber: number) => onPlay(seasonNumber, episodeNumber);
  const isCurrent =
    current?.season === seasonNumber && current?.episode === active.episode_number;

  // ── Swipe ────────────────────────────────────────────────────────────────
  // `swiped` swallows the click that follows a drag so a swipe never starts
  // playback.
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

  /** Centre card plays; a flanking card is promoted to centre first. */
  const onCardClick = (i: number, episodeNumber: number) => {
    if (swiped.current) {
      swiped.current = false;
      return;
    }
    if (i === index) play(episodeNumber);
    else setIndex(i);
  };

  const title = active.name || `${t('episode')} ${active.episode_number}`;
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

  return (
    <div className="fp-epc">
      {/* Stack. `perspective` lives on the track; the lift needs headroom above
          it, which is the track's padding-top. */}
      <div
        className="fp-epc-stage relative"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="fp-epc-track" ref={trackRef}>
          {episodes.map((episode, i) => {
            const style = getStackStyle(i, index, total, trackWidth);
            const featured = i === index;
            const visible = style.opacity !== 0;
            return (
              <button
                key={episode.episode_number}
                type="button"
                className={`fp-epc-card${featured ? ' is-featured' : ''}`}
                style={style}
                onClick={() => onCardClick(i, episode.episode_number)}
                /* Hidden cards are removed from the tab order and the a11y tree
                   so a 24-episode season is not 24 stops on a phone. */
                tabIndex={visible ? 0 : -1}
                aria-hidden={visible ? undefined : true}
                aria-label={
                  featured
                    ? `${t('play')} ${title}`
                    : `${t('episode')} ${episode.episode_number}: ${episode.name || ''}`
                }
              >
                {episode.still_path ? (
                  <img
                    src={`${STILL}${episode.still_path}`}
                    srcSet={`${STILL}${episode.still_path} 500w, ${STILL_LG}${episode.still_path} 780w`}
                    sizes="80vw"
                    alt=""
                    loading={Math.abs(i - index) <= 1 ? 'eager' : 'lazy'}
                    draggable={false}
                  />
                ) : (
                  <span className="fp-epc-card-fallback" aria-hidden="true" />
                )}

                <span className="fp-epc-card-num" aria-hidden="true">
                  {episode.episode_number}
                </span>

                {featured && (
                  <span className="fp-epc-card-play" aria-hidden="true">
                    <span className="fp-epc-card-play-dot flex flex-col items-center justify-center gap-1">
                      <Play size={22} className="fill-current" />
                      <span className="text-[10px] font-bold tracking-widest uppercase text-white drop-shadow-md">Play</span>
                    </span>
                  </span>
                )}

                {current?.season === seasonNumber &&
                  current?.episode === episode.episode_number && (
                    <span className="fp-epc-card-badge">{t('statePlaying')}</span>
                  )}
              </button>
            );
          })}
        </div>

        {/* Clickable prev/next buttons flanking the featured still, so an
            episode can be changed by tapping beside the photo (not only by
            swiping or using the strip). */}
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label={t('prevEpisode')}
              className="absolute left-1 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <ArrowLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label={t('nextEpisode')}
              className="absolute right-1 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <ArrowRight size={18} />
            </button>
          </>
        )}
      </div>

      {/* Copy. Same blur-in-per-word treatment the circular carousel uses for a
          quote, applied to the episode title. */}
      <div className="fp-epc-copy">
        <AnimatePresence mode="wait">
          <motion.div
            key={active.episode_number}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <p className="fp-epc-eyebrow">
              <span className="fp-epc-rule" aria-hidden="true" />
              {t('season')} {seasonNumber} · {t('episode')} {active.episode_number}
            </p>

            <h3 className="fp-epc-title">
              {title.split(' ').map((word, i) => (
                <motion.span
                  key={`${active.episode_number}-${i}`}
                  initial={{ filter: 'blur(10px)', opacity: 0, y: 5 }}
                  animate={{ filter: 'blur(0px)', opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, ease: 'easeInOut', delay: 0.025 * i }}
                  style={{ display: 'inline-block' }}
                >
                  {word}&nbsp;
                </motion.span>
              ))}
            </h3>

            {meta && <p className="fp-epc-meta">{meta}</p>}
            {active.overview && <p className="fp-epc-overview">{active.overview}</p>}
          </motion.div>
        </AnimatePresence>

        <button
          type="button"
          className="fp-epc-play"
          onClick={() => play(active.episode_number)}
        >
          <Play size={16} className="fill-current" />
          {t('play')}
          {isCurrent && (
            <span className="fp-epc-play-sub">
              · S{seasonNumber} E{active.episode_number}
            </span>
          )}
        </button>
      </div>

      {/* Round arrows, as in the circular carousel — plus the numbered strip,
          which is what keeps a 24-episode season one tap deep. */}
      <div className="fp-epc-controls">
        <button
          type="button"
          className="fp-epc-arrow"
          onClick={() => go(-1)}
          aria-label={t('prevEpisode')}
        >
          <ArrowLeft size={20} />
        </button>

        <div className="fp-epc-strip" ref={stripRef}>
          {episodes.map((ep, i) => (
            <button
              key={ep.episode_number}
              type="button"
              data-active={i === index || undefined}
              onClick={() => setIndex(i)}
              className={`fp-epc-chip${i === index ? ' is-active' : ''}`}
              title={ep.name || `${t('episode')} ${ep.episode_number}`}
              aria-current={i === index ? 'true' : undefined}
            >
              {ep.episode_number}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="fp-epc-arrow"
          onClick={() => go(1)}
          aria-label={t('nextEpisode')}
        >
          <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );
}
