import { useState, useEffect, useCallback, useRef } from 'react';
import type { HeroSlide } from '../../lib/tmdb';

const SLIDE_MS = 3000; // 3 seconds per slide

interface Props {
  slides: HeroSlide[];
  label?: string;
}

export default function HeroCarousel({ slides, label }: Props) {
  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const goTo = useCallback((i: number) => {
    if (count === 0) return;
    setIndex(((i % count) + count) % count);
  }, [count]);

  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1), [goTo, index]);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(mq.matches);
    const handler = () => setReduceMotion(mq.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  // Autoplay — 3s, pause on hover/focus, skip if reduced motion.
  useEffect(() => {
    if (paused || reduceMotion || count <= 1) return;
    const id = window.setTimeout(next, SLIDE_MS);
    return () => window.clearTimeout(id);
  }, [index, paused, reduceMotion, count, next]);

  // Preload next slide.
  useEffect(() => {
    if (count <= 1) return;
    const nextUrl = slides[(index + 1) % count]?.backdropUrl;
    if (nextUrl) { const img = new Image(); img.src = nextUrl; }
  }, [index, count, slides]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
  }, [next, prev]);

  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 48) (dx < 0 ? next : prev)();
    touchStartX.current = null;
  };

  if (count === 0) return null;

  const slide = slides[index];

  return (
    <section
      className="nf-hero"
      aria-roledescription="carousel"
      aria-label={label ? `${label} carousel` : 'Featured content'}
      tabIndex={0}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={onKeyDown}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Backdrop images — crossfade stack */}
      <div className="nf-stage" aria-hidden="true">
        {slides.map((s, i) => (
          <div key={s.id} className={`nf-bg ${i === index ? 'nf-bg--active' : ''}`}>
            {s.backdropUrl && (
              <img
                src={s.backdropUrl}
                alt=""
                className="nf-bg-img"
                loading={i === 0 ? 'eager' : 'lazy'}
                decoding="async"
                fetchPriority={i === 0 ? 'high' : 'low'}
              />
            )}
          </div>
        ))}
        {/* Gradient overlays */}
        <div className="nf-grad-bottom" />
        <div className="nf-grad-left" />
        <div className="nf-grad-top" />
      </div>

      {/* Content panel */}
      <div className="nf-content">
        {/* Type + IMDb row */}
        <div className="nf-meta">
          <span className="nf-type-badge">
            {slide.mediaType === 'movie' ? '🎬 Movie' : '📺 Series'}
          </span>
          {slide.rating > 0 && (
            <span className="nf-imdb">
              <span className="nf-imdb-lozenge">IMDb</span>
              {slide.rating.toFixed(1)}
            </span>
          )}
          {slide.releaseYear && <span className="nf-pill">{slide.releaseYear}</span>}
          {slide.runtime && <span className="nf-pill">{slide.runtime}</span>}
        </div>

        {/* Title */}
        <h1 className="nf-title" key={`title-${slide.id}`}>{slide.title}</h1>

        {/* Genre chips */}
        {slide.genres.length > 0 && (
          <div className="nf-genres">
            {slide.genres.map((g) => (
              <span key={g} className="nf-genre">{g}</span>
            ))}
          </div>
        )}

        {/* Overview */}
        {slide.overview && (
          <p className="nf-overview">{slide.overview}</p>
        )}

        {/* Action buttons */}
        <div className="nf-actions">
          <a href={slide.href} className="nf-btn nf-btn--play">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M6 4.75a.75.75 0 0 1 1.18-.61l12 7.25a.75.75 0 0 1 0 1.22l-12 7.25A.75.75 0 0 1 6 19.25V4.75z"/>
            </svg>
            Play
          </a>
          <a href={slide.href} className="nf-btn nf-btn--info">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
            </svg>
            More Info
          </a>
          <WatchlistBtn id={slide.id} mediaType={slide.mediaType} title={slide.title} posterUrl={slide.posterUrl} />
        </div>
      </div>

      {/* Bottom strip: progress bar + dots + arrows */}
      <div className="nf-strip">
        <button className="nf-arrow nf-arrow--prev" onClick={prev} aria-label="Previous">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
        </button>

        <div className="nf-dots" role="tablist" aria-label="Slide navigation">
          {slides.map((s, i) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={i === index}
              aria-label={`${s.title}`}
              className={`nf-dot ${i === index ? 'nf-dot--active' : ''}`}
              onClick={() => goTo(i)}
            />
          ))}
        </div>

        <button className="nf-arrow nf-arrow--next" onClick={next} aria-label="Next">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      </div>

      {/* Thin progress bar at very bottom — removed */}

      <style>{`
        @keyframes nf-fade-up {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes nf-kenburns {
          from { transform: scale(1.06); }
          to   { transform: scale(1); }
        }

        /* ── Container ── */
        .nf-hero {
          position: relative;
          width: 100%;
          min-height: 100svh;
          max-height: 100svh;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          overflow: hidden;
          background: #000;
          outline: none;
        }
        @media (max-width: 767px) {
          .nf-hero { min-height: 88svh; max-height: 88svh; }
        }

        /* ── Backdrop ── */
        .nf-stage { position: absolute; inset: 0; }
        .nf-bg { position: absolute; inset: 0; opacity: 0; transition: opacity 1s ease; will-change: opacity; }
        .nf-bg--active { opacity: 1; }
        .nf-bg-img { width: 100%; height: 100%; object-fit: cover; object-position: center 20%; display: block; }
        .nf-bg--active .nf-bg-img { animation: nf-kenburns 6s ease-out forwards; }

        /* Gradients — Netflix uses a heavy bottom+left vignette */
        .nf-grad-bottom {
          position: absolute; inset: 0;
          background: linear-gradient(
            to top,
            #000 0%,
            rgba(0,0,0,0.9) 18%,
            rgba(0,0,0,0.5) 45%,
            rgba(0,0,0,0.1) 75%,
            transparent 100%
          );
        }
        .nf-grad-left {
          position: absolute; inset: 0;
          background: linear-gradient(
            to right,
            rgba(0,0,0,0.85) 0%,
            rgba(0,0,0,0.45) 35%,
            transparent 65%
          );
        }
        .nf-grad-top {
          position: absolute; top: 0; left: 0; right: 0; height: 120px;
          background: linear-gradient(to bottom, rgba(0,0,0,0.5), transparent);
        }

        /* ── Content panel ── */
        .nf-content {
          position: relative;
          z-index: 2;
          padding: 0 4% 5rem;
          max-width: 680px;
        }
        @media (max-width: 767px) {
          .nf-content {
            padding: 0 1rem calc(72px + env(safe-area-inset-bottom, 0px) + 1.5rem) 1rem;
            max-width: 100%;
          }
        }


        /* Meta row */
        .nf-meta {
          display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;
          margin-bottom: 0.625rem;
          animation: nf-fade-up 0.5s ease backwards; animation-delay: 60ms;
        }
        .nf-type-badge {
          font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.04em;
          color: rgba(255,255,255,0.85);
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.2);
          padding: 0.2rem 0.5rem; border-radius: 4px;
          white-space: nowrap;
        }
        .nf-imdb {
          display: inline-flex; align-items: center; gap: 0.35rem;
          font-size: 0.875rem; font-weight: 700; color: #fff;
        }
        .nf-imdb-lozenge {
          background: #f5c518; color: #000; font-weight: 900; font-size: 0.65rem;
          padding: 0.1rem 0.3rem; border-radius: 3px; letter-spacing: 0.02em;
        }
        .nf-pill {
          font-size: 0.8125rem; color: rgba(255,255,255,0.65); font-weight: 500;
        }
        .nf-pill + .nf-pill::before { content: '·'; margin-right: 0.5rem; opacity: 0.4; }
        .nf-imdb + .nf-pill::before,
        .nf-type-badge + .nf-imdb::before,
        .nf-type-badge + .nf-pill::before {
          content: '';
          display: inline-block;
          width: 3px; height: 3px;
          border-radius: 50%;
          background: rgba(255,255,255,0.35);
          margin-right: 0;
          vertical-align: middle;
        }

        /* Title */
        .nf-title {
          font-size: clamp(2rem, 4.5vw, 3.75rem);
          font-weight: 700;
          line-height: 1.05;
          letter-spacing: -0.025em;
          color: #fff;
          margin: 0 0 0.75rem;
          text-shadow: 0 2px 24px rgba(0,0,0,0.7);
          animation: nf-fade-up 0.5s ease backwards; animation-delay: 100ms;
        }
        @media (max-width: 767px) {
          .nf-title { font-size: clamp(1.75rem, 7vw, 2.5rem); }
        }

        /* Genres */
        .nf-genres {
          display: flex; gap: 0.375rem; flex-wrap: wrap; margin-bottom: 0.75rem;
          animation: nf-fade-up 0.5s ease backwards; animation-delay: 130ms;
        }
        .nf-genre {
          font-size: 0.75rem; font-weight: 500;
          color: rgba(255,255,255,0.65);
          border-left: 2px solid rgba(255,255,255,0.3);
          padding-left: 0.5rem;
        }
        .nf-genre:first-child { border-left: none; padding-left: 0; color: rgba(255,255,255,0.8); }

        /* Overview */
        .nf-overview {
          font-size: clamp(0.875rem, 1.4vw, 1rem);
          line-height: 1.55;
          color: rgba(255,255,255,0.78);
          margin: 0 0 1.5rem;
          max-width: 520px;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
          animation: nf-fade-up 0.5s ease backwards; animation-delay: 160ms;
        }
        @media (max-width: 767px) { .nf-overview { -webkit-line-clamp: 2; } }

        /* Buttons */
        .nf-actions {
          display: flex; gap: 0.625rem; flex-wrap: wrap; align-items: center;
          animation: nf-fade-up 0.5s ease backwards; animation-delay: 200ms;
        }
        .nf-btn {
          display: inline-flex; align-items: center; gap: 0.5rem;
          padding: 0.6rem 1.5rem;
          font-size: 1rem; font-weight: 700;
          border-radius: 4px;
          cursor: pointer; text-decoration: none;
          border: none; transition: all 0.15s ease;
          white-space: nowrap; line-height: 1;
          min-height: 44px;
        }
        .nf-btn--play {
          background: #fff; color: #000;
          box-shadow: 0 4px 16px rgba(0,0,0,0.4);
        }
        .nf-btn--play:hover { background: rgba(255,255,255,0.85); transform: scale(1.03); }
        .nf-btn--info {
          background: rgba(109,109,110,0.7);
          color: #fff;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }
        .nf-btn--info:hover { background: rgba(109,109,110,0.5); transform: scale(1.03); }
        .nf-btn--wl {
          background: transparent;
          color: rgba(255,255,255,0.7);
          border: 2px solid rgba(255,255,255,0.4);
          width: 44px; height: 44px;
          padding: 0;
          border-radius: 50%;
          justify-content: center;
          flex-shrink: 0;
        }
        .nf-btn--wl:hover { border-color: #fff; color: #fff; }
        .nf-btn--wl--saved { border-color: #e50914; color: #e50914; }
        @media (max-width: 767px) {
          .nf-btn {
            padding: 0.75rem 1.375rem;
            font-size: 0.9375rem;
            border-radius: 9999px;
            min-height: 48px;
          }
          .nf-btn--wl {
            width: 48px; height: 48px;
          }
        }
        @media (max-width: 767px) {
          .nf-actions { gap: 0.5rem; }
          .nf-btn {
            padding: 0.75rem 1.375rem;
            font-size: 0.9375rem;
            min-height: 48px;
            border-radius: 9999px;
          }
          .nf-btn--wl {
            width: 48px; height: 48px;
            border-radius: 50%;
            flex-shrink: 0;
          }
        }

        /* Right-side platform overlay */
        .nf-platforms {
          position: absolute;
          right: 4%;
          top: 46%;
          transform: translateY(-50%);
          z-index: 2;
        }
        @media (max-width: 1023px) {
          .nf-platforms { display: none; }
        }

        /* Bottom strip */
        .nf-strip {
          position: relative; z-index: 3;
          display: flex; align-items: center; justify-content: center;
          gap: 1rem;
          padding: 0.75rem 4% 1.25rem;
        }
        @media (max-width: 767px) {
          .nf-strip { padding: 0.5rem 1rem 1rem; gap: 0.5rem; }
        }
        .nf-dots { display: flex; gap: 0.375rem; align-items: center; }
        .nf-dot {
          width: 12px; height: 3px; border-radius: 2px; border: none;
          background: rgba(255,255,255,0.3); cursor: pointer; padding: 0;
          transition: all 0.25s ease;
          min-height: unset;
        }
        .nf-dot--active { background: #fff; width: 28px; }
        .nf-arrow {
          width: 40px; height: 40px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);
          color: rgba(255,255,255,0.75); cursor: pointer;
          transition: all 0.18s ease;
          min-height: unset;
        }
        .nf-arrow:hover { background: rgba(255,255,255,0.2); color: #fff; transform: scale(1.1); }
        @media (max-width: 767px) { .nf-arrow { display: none; } }

        /* Reduced motion */
        @media (prefers-reduced-motion: reduce) {
          .nf-bg { transition: none; }
          .nf-bg--active .nf-bg-img { animation: none; }
          .nf-content > *, .nf-number { animation: none; opacity: 1; transform: none; }
        }
      `}</style>
    </section>
  );
}

// Watchlist toggle button
function WatchlistBtn({ id, mediaType, title, posterUrl }: {
  id: number; mediaType: 'movie' | 'tv'; title: string; posterUrl: string | null;
}) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const wl = JSON.parse(localStorage.getItem('filmora_watchlist') || '[]') as Array<{ id: number; mediaType: string }>;
      setSaved(wl.some((i) => i.id === id && i.mediaType === mediaType));
    } catch {}
  }, [id, mediaType]);

  const toggle = () => {
    try {
      const wl = JSON.parse(localStorage.getItem('filmora_watchlist') || '[]') as Array<{
        id: number; mediaType: string; title: string; posterUrl: string | null; addedAt: string;
      }>;
      const idx = wl.findIndex((i) => i.id === id && i.mediaType === mediaType);
      const next = idx >= 0
        ? wl.filter((_, i) => i !== idx)
        : [...wl, { id, mediaType, title, posterUrl, addedAt: new Date().toISOString() }];
      localStorage.setItem('filmora_watchlist', JSON.stringify(next));
      setSaved(idx < 0);
    } catch {}
  };

  return (
    <button
      className={`nf-btn nf-btn--wl ${saved ? 'nf-btn--wl--saved' : ''}`}
      onClick={toggle}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${title} from watchlist` : `Add ${title} to watchlist`}
      title={saved ? 'Remove from Watchlist' : 'Add to Watchlist'}
    >
      {saved
        ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20 6 9 17l-5-5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
        : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
      }
    </button>
  );
}
