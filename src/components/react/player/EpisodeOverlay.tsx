// src/components/react/player/EpisodeOverlay.tsx — season + episode picker.
//
// One component, two presentations:
//   variant="overlay" — slides over the video from the control bar (the Netflix
//                       "Episodes" button). Scroll-locked to its own panel and
//                       closable with Escape or the close button.
//   variant="inline"  — the same list below the player for browsing without
//                       covering the video, which is what a discovery page wants.
//                       This variant has three shapes: the 3D fanned stills
//                       (EpisodeCircle) on phones, the container-query list with
//                       real columns at tablet widths, and the editorial split
//                       hero (EpisodeSpotlight) from 64rem up. A 24-row
//                       single-column list buries the rest of the page on a
//                       390px screen, so the phone gets the carousel — with a
//                       numbered strip as the picker so episode 23 stays one tap
//                       away.
//
// The current episode is marked with `aria-current` and scrolled into view when
// the list opens, so a viewer 14 episodes deep does not land at the top.

import { useEffect, useRef } from 'react';
import { CloseIcon, PlayIcon } from './Icons';
import EpisodeSpotlight from './EpisodeSpotlight';
import EpisodeCircle from './EpisodeCircle';
import type { PlayerT } from '../../../lib/player/strings';

export interface SeasonOption {
  season_number: number;
  name: string;
  episode_count: number;
}

export interface EpisodeItem {
  episode_number: number;
  name: string;
  overview: string;
  still_path: string | null;
  air_date: string;
  runtime: number | null;
}

interface EpisodeOverlayProps {
  variant: 'overlay' | 'inline';
  seasons: SeasonOption[];
  activeSeason: number;
  onSeason: (season: number) => void;
  episodes: EpisodeItem[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  current: { season: number; episode: number } | null;
  onPlay: (season: number, episode: number) => void;
  onClose?: () => void;
  t: PlayerT;
}

const STILL = 'https://image.tmdb.org/t/p/w300';

export default function EpisodeOverlay({
  variant,
  seasons,
  activeSeason,
  onSeason,
  episodes,
  loading,
  error,
  onRetry,
  current,
  onPlay,
  onClose,
  t,
}: EpisodeOverlayProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  // Bring the episode being watched into view when the panel appears.
  useEffect(() => {
    if (!current || episodes.length === 0) return;
    const node = listRef.current?.querySelector<HTMLElement>('[data-current="true"]');
    node?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  }, [current, episodes.length]);

  // Keep the active season tab visible in the horizontal scroller. With a long
  // show (20+ seasons) the selected tab can sit far off the right edge, so
  // centre it whenever the selection changes.
  useEffect(() => {
    const active = tabsRef.current?.querySelector<HTMLElement>('.fp-season-tab.is-active');
    active?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [activeSeason]);

  return (
    <div className={variant === 'overlay' ? 'fp-episodes fp-episodes-overlay' : 'fp-episodes'}>
      <div className="fp-episodes-head">
        <h3 className="fp-menu-title">{t('episodes')}</h3>
        {seasons.length > 1 && (
          <div className="fp-season-tabs" role="tablist" aria-label={t('season')} ref={tabsRef}>
            {seasons.map((season) => {
              /* Season 0 is TMDB's "Specials" bucket, and for some titles it is
                 the only season that exists. "Season 0" would be wrong and
                 confusing, so those tabs use the season's own name. */
              const label =
                season.season_number === 0
                  ? season.name || t('season')
                  : `${t('season')} ${season.season_number}`;
              return (
                <button
                  key={season.season_number}
                  type="button"
                  role="tab"
                  aria-selected={activeSeason === season.season_number}
                  className={`fp-season-tab${activeSeason === season.season_number ? ' is-active' : ''}`}
                  onClick={() => onSeason(season.season_number)}
                >
                  <span className="fp-season-tab-name">{label}</span>
                  {/* Episode count as a dimmed second half of the pill. Only
                      when it is real: TMDB reports 0 for plenty of currently
                      airing seasons, and "· 0" reads as broken. */}
                  {season.episode_count > 0 && (
                    <>
                      <span className="fp-season-tab-sep" aria-hidden="true">
                        ·
                      </span>
                      <span className="fp-season-tab-count">{season.episode_count}</span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        )}
        {variant === 'overlay' && onClose && (
          <button
            type="button"
            className="fp-btn fp-btn-sm fp-episodes-close"
            onClick={onClose}
            aria-label={t('close')}
          >
            <CloseIcon size={18} />
          </button>
        )}
      </div>

      {loading ? (
        <ul className="fp-episode-list" aria-busy="true">
          {Array.from({ length: 6 }).map((_, index) => (
            <li key={index} className="fp-episode-skeleton" />
          ))}
        </ul>
      ) : error ? (
        <div className="fp-episodes-empty" role="alert">
          <p>{t('errNetwork')}</p>
          <button type="button" className="fp-pill" onClick={onRetry}>
            {t('retry')}
          </button>
        </div>
      ) : episodes.length === 0 ? (
        <p className="fp-episodes-empty">{t('noEpisodes')}</p>
      ) : (
        <>
          {/* Three inline presentations, one per width, all in the DOM with
              media queries in player.css picking one — a CSS swap rather than a
              JS width check, so the right layout is there on the first frame
              after hydration instead of one render late.
                <40rem  → EpisodeCircle   (3D fanned stills)
                40–64rem → the list below  (container query gives it columns)
                >=64rem → EpisodeSpotlight (editorial split hero) */}
          {variant === 'inline' && (
            <>
              <div className="fp-ep-circle-wrap">
                <EpisodeCircle
                  episodes={episodes}
                  seasonNumber={activeSeason}
                  current={current}
                  onPlay={onPlay}
                  t={t}
                />
              </div>
              <div className="fp-ep-spotlight-wrap">
                <EpisodeSpotlight
                  episodes={episodes}
                  seasonNumber={activeSeason}
                  current={current}
                  onPlay={onPlay}
                  t={t}
                />
              </div>
            </>
          )}

          <ul
            className={`fp-episode-list${variant === 'inline' ? ' fp-episode-list-wide' : ''}`}
            ref={listRef}
          >
            {episodes.map((episode) => {
              const isCurrent =
                current?.season === activeSeason && current?.episode === episode.episode_number;
              return (
                <li key={episode.episode_number}>
                  <button
                    type="button"
                    className={`fp-episode${isCurrent ? ' is-current' : ''}`}
                    onClick={() => onPlay(activeSeason, episode.episode_number)}
                    aria-current={isCurrent ? 'true' : undefined}
                    data-current={isCurrent ? 'true' : undefined}
                  >
                    <span className="fp-episode-thumb">
                      {episode.still_path ? (
                        <img src={`${STILL}${episode.still_path}`} alt="" loading="lazy" />
                      ) : (
                        <span className="fp-episode-thumb-fallback" aria-hidden="true" />
                      )}
                      <span className="fp-episode-play" aria-hidden="true">
                        <div className="flex flex-col items-center gap-1">
                          <PlayIcon size={18} />
                          <span className="text-[10px] font-bold tracking-widest uppercase text-white drop-shadow-md">Play</span>
                        </div>
                      </span>
                    </span>
                    <span className="fp-episode-meta">
                      <span className="fp-episode-num">
                        {t('episode')} {episode.episode_number}
                        {episode.runtime ? ` · ${episode.runtime}m` : ''}
                      </span>
                      <span className="fp-episode-name">{episode.name}</span>
                      {variant === 'inline' && episode.overview && (
                        <span className="fp-episode-overview">{episode.overview}</span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
