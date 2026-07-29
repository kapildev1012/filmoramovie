import { useState, useEffect, useCallback, useRef } from 'react';
import type { HeroSlide } from '../../lib/tmdb';
import { InteractiveHoverButton } from '../ui/interactive-hover-button';

const SLIDE_MS = 3000; // 3 seconds per slide
const MAX_GENRES = 3;  // keep the chip row on a single line

/**
 * Build a width ladder for a TMDB backdrop URL.
 *
 * `buildHeroSlides` returns backdrops at a fixed `/w1280/`. TMDB exposes the
 * same still at several widths under the same path, so we can offer the browser
 * a choice instead of forcing the largest one on every device. Returns
 * undefined for anything that is not a recognisable TMDB w1280 URL, in which
 * case the plain `src` is used unchanged.
 */
function backdropSrcSet(url: string): string | undefined {
  if (!url.includes('/w1280/')) return undefined;
  const widths = [780, 1280];
  return widths
    .map((w) => `${url.replace('/w1280/', `/w${w}/`)} ${w}w`)
    .join(', ');
}

interface Props {
  slides: HeroSlide[];
  label?: string;
}

export default function HeroCarousel({ slides, label }: Props) {
  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [hoverPaused, setHoverPaused] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

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

  const paused = hoverPaused || userPaused;
  const autoplays = !reduceMotion && count > 1;

  // Remaining time for the current slide. Tracked explicitly so that pausing
  // (hover/focus/touch or the pause button) resumes where it left off — the
  // progress bar freezes with `animation-play-state`, so a timer that restarted
  // from scratch would drift out of sync with what the user sees.
  const remainingRef = useRef(SLIDE_MS);
  const startedAtRef = useRef(0);

  useEffect(() => {
    remainingRef.current = SLIDE_MS;
  }, [index]);

  useEffect(() => {
    if (!autoplays || paused) {
      if (startedAtRef.current) {
        remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedAtRef.current));
        startedAtRef.current = 0;
      }
      return;
    }
    startedAtRef.current = Date.now();
    const id = window.setTimeout(next, remainingRef.current);
    return () => window.clearTimeout(id);
  }, [index, paused, autoplays, next]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
  }, [next, prev]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setHoverPaused(true); // don't advance while the user is interacting
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    setHoverPaused(false);
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    // Only treat as a slide swipe when the gesture is clearly horizontal —
    // otherwise a vertical scroll would accidentally change slides.
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      (dx < 0 ? next : prev)();
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  if (count === 0) return null;

  const slide = slides[index];
  const genres = slide.genres.slice(0, MAX_GENRES);

  return (
    <section
      className={`nf-hero ${count === 1 ? 'nf-hero--single' : ''}`}
      aria-roledescription="carousel"
      aria-label={label ? `${label} carousel` : 'Featured content'}
      tabIndex={0}
      onMouseEnter={() => setHoverPaused(true)}
      onMouseLeave={() => setHoverPaused(false)}
      onFocus={() => setHoverPaused(true)}
      onBlur={() => setHoverPaused(false)}
      onKeyDown={onKeyDown}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Only mount the active and adjacent images. Absolutely positioned lazy
          images all count as in-viewport, so mounting every slide fetched every
          w1280 backdrop immediately. */}
      <div className="nf-stage" aria-hidden="true">
        {slides.map((s, i) => {
          const shouldLoad = i === index || i === (index + 1) % count || i === (index - 1 + count) % count;
          const srcSet = s.backdropUrl ? backdropSrcSet(s.backdropUrl) : undefined;
          return (
          <div key={s.id} className={`nf-bg ${i === index ? 'nf-bg--active' : ''}`}>
            {s.backdropUrl && shouldLoad && (
              <img
                src={s.backdropUrl}
                /* buildHeroSlides bakes w1280 into backdropUrl, so a phone was
                   downloading a desktop-sized backdrop (up to ~230 kB each, and
                   three slides are mounted at a time — the single largest item
                   in a page's transfer). TMDB serves the same still at fixed
                   widths, so hand the browser the ladder and let it pick. */
                srcSet={srcSet}
                sizes="100vw"
                alt=""
                className="nf-bg-img"
                loading={i === index ? 'eager' : 'lazy'}
                decoding="async"
                fetchPriority={i === index ? 'high' : 'low'}
              />
            )}
          </div>
          );
        })}
        {/* Gradient overlays */}
        <div className="nf-grad-bottom" />
        <div className="nf-grad-left" />
        <div className="nf-grad-top" />
      </div>

      {/* Content panel — remounted per slide so the staggered entrance replays.
          `aria-live` announces the new slide for screen readers. */}
      <div className="nf-content-wrap" aria-live="polite" aria-atomic="true">
        <div className="nf-content" key={slide.id}>
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
          <h1 className="nf-title">{slide.title}</h1>

          {/* Genre chips */}
          {genres.length > 0 && (
            <div className="nf-genres">
              {genres.map((g) => (
                <span key={g} className="nf-genre">{g}</span>
              ))}
            </div>
          )}

          {/* Overview */}
          {slide.overview && (
            <p className="nf-overview">{slide.overview}</p>
          )}

          {/* Primary action + watchlist. The animated control is intentionally
              the only navigation CTA: the old desktop “More Info” button led to
              the same place and read like a duplicate trailer action. */}
          <div className="nf-actions">
            <InteractiveHoverButton
              type="button"
              text="Watch Now"
              onClick={() => { window.location.href = slide.href; }}
              className="nf-ihb"
              aria-label={`Watch ${slide.title} now`}
            />
            <WatchlistBtn id={slide.id} mediaType={slide.mediaType} title={slide.title} posterUrl={slide.posterUrl} />
          </div>
        </div>
      </div>

      {/* Bottom strip: counter + progress dots on the copy edge, controls opposite */}
      {count > 1 && (
        <div className={`nf-strip ${paused ? 'is-paused' : ''}`}>
          <div className="nf-strip-left">
            <span className="nf-counter" aria-hidden="true">
              <b>{String(index + 1).padStart(2, '0')}</b>
              <i>/</i>
              {String(count).padStart(2, '0')}
            </span>
            <div className={`nf-dots ${autoplays ? '' : 'nf-dots--static'}`} aria-label="Slide navigation">
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  aria-current={i === index ? 'true' : undefined}
                  aria-label={`Go to slide ${i + 1} of ${count}: ${s.title}`}
                  className={`nf-dot ${i === index ? 'nf-dot--active' : ''}`}
                  onClick={() => goTo(i)}
                >
                  <span
                    className="nf-dot-fill"
                    style={{ animationDuration: `${SLIDE_MS}ms` }}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="nf-strip-right">
            {autoplays && (
              <button
                type="button"
                className="nf-ctl"
                onClick={() => setUserPaused((v) => !v)}
                aria-label={userPaused ? 'Resume automatic slideshow' : 'Pause automatic slideshow'}
              >
                {userPaused
                  ? <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.75a.75.75 0 0 1 1.18-.61l11 7.25a.75.75 0 0 1 0 1.22l-11 7.25A.75.75 0 0 1 7 19.25V4.75z"/></svg>
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/></svg>}
              </button>
            )}
            <button type="button" className="nf-ctl nf-ctl--prev" onClick={prev} aria-label="Previous slide">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <button type="button" className="nf-ctl nf-ctl--next" onClick={next} aria-label="Next slide">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes nf-fade-up {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes nf-kenburns {
          from { transform: scale(1.06); }
          to   { transform: scale(1); }
        }
        @keyframes nf-progress {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }

        /* ── Container ──
           Grid instead of flex column: row 1 holds the copy (bottom-aligned,
           so it grows upward), row 2 pins the control strip. Slide-to-slide
           differences in title/overview height no longer shift the strip. */
        .nf-hero {
          position: relative;
          width: 100%;
          min-height: 100svh;
          max-height: 100svh;
          display: grid;
          grid-template-rows: 1fr auto;
          overflow: hidden;
          background: #000;
          outline: none;
          touch-action: pan-y; /* allow vertical scroll; we handle horizontal swipes */
        }
        .nf-hero:focus-visible { box-shadow: inset 0 0 0 2px rgba(255,255,255,0.6); }
        @media (max-width: 767px) {
          .nf-hero { min-height: 82svh; max-height: 82svh; }
          /* Frame the subject's face/upper body on portrait screens */
          .nf-bg-img { object-position: center 18%; }
        }
        /* Short landscape phones: a viewport-height hero leaves no room for the
           copy, so let it size to content instead of clipping. */
        @media (max-height: 520px) and (orientation: landscape) {
          .nf-hero { min-height: 460px; max-height: none; }
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
        .nf-content-wrap {
          position: relative;
          z-index: 2;
          align-self: end;
          padding: 0 4% 1.75rem;
          width: 100%;
        }
        .nf-content { max-width: 680px; }
        /* No strip to sit above (single-slide detail heroes) — restore the space */
        .nf-hero--single .nf-content-wrap { padding-bottom: 5rem; }
        @media (max-width: 767px) {
          .nf-content-wrap {
            padding: 0 1.25rem 1rem;
            text-align: center;
          }
          .nf-content {
            max-width: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          /* Single-slide hero has no strip, so it must clear the tab bar itself */
          .nf-hero--single .nf-content-wrap {
            padding-bottom: calc(64px + env(safe-area-inset-bottom, 0px) + 1rem);
          }
          /* Centered text reads best over a taller bottom fade; drop the
             left vignette which only helps left-aligned desktop copy. */
          .nf-grad-bottom {
            background: linear-gradient(
              to top,
              #000 0%,
              rgba(0,0,0,0.94) 24%,
              rgba(0,0,0,0.6) 50%,
              rgba(0,0,0,0.15) 78%,
              transparent 100%
            );
          }
          .nf-grad-left { display: none; }
        }


        /* Meta row */
        .nf-meta {
          display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;
          margin-bottom: 0.625rem;
          animation: nf-fade-up 0.5s ease backwards; animation-delay: 60ms;
        }
        /* Plain text, no chip: the translucent box read as an empty block over
           the artwork, especially where the backdrop behind it is already dark. */
        .nf-type-badge {
          font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.04em;
          color: rgba(255,255,255,0.85);
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

        /* Title — capped at two lines so a long name can't push the copy block
           past the top of the hero. */
        .nf-title {
          font-size: clamp(2rem, 4.5vw, 3.75rem);
          font-weight: 700;
          line-height: 1.05;
          letter-spacing: -0.025em;
          color: #fff;
          margin: 0 0 0.75rem;
          text-shadow: 0 2px 24px rgba(0,0,0,0.7);
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          animation: nf-fade-up 0.5s ease backwards; animation-delay: 100ms;
        }
        @media (max-width: 767px) {
          .nf-title { font-size: clamp(1.75rem, 7vw, 2.5rem); }
          .nf-meta { justify-content: center; gap: 0.4rem; margin-bottom: 0.5rem; }
        }

        /* Genres */
        .nf-genres {
          display: flex; gap: 0.375rem; margin-bottom: 0.75rem;
          animation: nf-fade-up 0.5s ease backwards; animation-delay: 130ms;
        }
        .nf-genre {
          font-size: 0.75rem; font-weight: 500;
          color: rgba(255,255,255,0.65);
          border-left: 2px solid rgba(255,255,255,0.3);
          padding-left: 0.5rem;
          white-space: nowrap;
        }
        .nf-genre:first-child { border-left: none; padding-left: 0; color: rgba(255,255,255,0.8); }

        /* Overview — height reserved for the clamp so slides with a one-line
           synopsis don't make the block jump against the ones with three. */
        .nf-overview {
          font-size: clamp(0.875rem, 1.4vw, 1rem);
          line-height: 1.55;
          color: rgba(255,255,255,0.78);
          margin: 0 0 1.5rem;
          max-width: 560px;
          min-height: calc(1.55em * 3);
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
          animation: nf-fade-up 0.5s ease backwards; animation-delay: 160ms;
        }
        @media (max-width: 767px) {
          .nf-overview {
            -webkit-line-clamp: 2;
            min-height: calc(1.55em * 2);
            margin-bottom: 1.25rem;
            font-size: 0.875rem;
          }
          /* Centered genres read cleaner with dot separators than left borders */
          .nf-genres { justify-content: center; gap: 0.5rem; margin-bottom: 0.875rem; }
          .nf-genre {
            border-left: none;
            padding-left: 0;
            color: rgba(255,255,255,0.7);
          }
          .nf-genre:first-child { color: rgba(255,255,255,0.7); }
          .nf-genre:not(:first-child)::before {
            content: '•';
            margin-right: 0.5rem;
            color: rgba(255,255,255,0.4);
          }
        }

        /* Actions: one clear, long primary button plus a compact list action. */
        .nf-actions {
          display: flex;
          align-items: center;
          gap: 0.875rem;
          width: 100%;
          animation: nf-fade-up 0.5s ease backwards;
          animation-delay: 200ms;
        }
        /* Override the component's shadcn default width/padding utilities with
           the hero's own sizing. The two-class selector is more specific than
           Tailwind's single utility classes regardless of stylesheet order;
           cn does not merge or dedupe conflicting utilities in this project. */
        .nf-actions .nf-ihb {
          width: min(240px, calc(100% - 58px));
          height: 55px;
          flex: 0 1 240px;
          font-size: 1.0625rem;
          color: #fff;
        }
        .nf-btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
          font-size: 1rem; font-weight: 700;
          cursor: pointer; text-decoration: none;
          transition: all 0.18s ease;
          white-space: nowrap; line-height: 1;
        }
        .nf-btn--wl {
          width: 50px; height: 50px;
          padding: 0;
          flex: 0 0 50px;
          border-radius: 50%;
          background: rgba(18,18,20,0.62);
          color: rgba(255,255,255,0.88);
          border: 1px solid rgba(255,255,255,0.34);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        }
        .nf-btn--wl:hover {
          border-color: #fff;
          color: #fff;
          transform: translateY(-2px);
          background: rgba(35,35,38,0.78);
        }
        .nf-btn--wl--saved { border-color: #e82728; color: #ff5b5d; }
        @media (max-width: 767px) {
          .nf-actions {
            justify-content: center;
            flex-wrap: nowrap;
            max-width: 420px;
            margin: 0.35rem auto 0;
            gap: 0.75rem;
          }
          .nf-actions .nf-ihb {
            width: auto;
            min-width: 0;
            height: 52px;
            flex: 1 1 auto;
            font-size: 0.9375rem;
          }
          .nf-btn--wl {
            width: 52px; height: 52px;
            flex-basis: 52px;
          }
        }
        @media (max-width: 380px) {
          .nf-actions { gap: 0.625rem; }
          .nf-play-animated { height: 50px; font-size: 0.875rem; }
          .nf-actions .nf-ihb { height: 50px; font-size: 0.875rem; }
          .nf-btn--wl { width: 50px; height: 50px; flex-basis: 50px; }
        }

        /* ── Bottom strip ──
           Aligned to the same 4% gutter as the copy: counter + progress dots on
           the reading edge, transport controls on the opposite edge. */
        .nf-strip {
          position: relative; z-index: 3;
          display: flex; align-items: center; justify-content: space-between;
          gap: 1rem;
          padding: 0 4% 2.25rem;
        }
        .nf-strip-left { display: flex; align-items: center; gap: 1rem; min-width: 0; }
        .nf-strip-right { display: flex; align-items: center; gap: 0.5rem; }

        /* Slide counter */
        .nf-counter {
          font-size: 0.75rem; font-variant-numeric: tabular-nums;
          letter-spacing: 0.08em;
          color: rgba(255,255,255,0.5);
          white-space: nowrap;
        }
        .nf-counter b { color: #fff; font-weight: 700; }
        .nf-counter i { font-style: normal; margin: 0 0.3rem; opacity: 0.5; }

        /* Dots double as an autoplay progress bar for the active slide */
        .nf-dots { display: flex; gap: 0.375rem; align-items: center; }
        .nf-dot {
          position: relative; overflow: hidden;
          width: 14px; height: 4px; border-radius: 999px; border: none;
          background: rgba(255,255,255,0.28); cursor: pointer; padding: 0;
          transition: width 0.35s ease, background 0.25s ease;
          min-height: unset;
        }
        .nf-dot:hover { background: rgba(255,255,255,0.55); }
        .nf-dot--active { width: 44px; background: rgba(255,255,255,0.3); }
        .nf-dot-fill {
          position: absolute; inset: 0;
          background: #fff; border-radius: inherit;
          transform: scaleX(0); transform-origin: left center;
        }
        .nf-dot--active .nf-dot-fill { animation-name: nf-progress; animation-timing-function: linear; animation-fill-mode: forwards; }
        .nf-strip.is-paused .nf-dot--active .nf-dot-fill { animation-play-state: paused; }
        /* Reduced motion / no autoplay: show the active dot filled, no sweep */
        .nf-dots--static .nf-dot--active .nf-dot-fill { animation: none; transform: scaleX(1); }

        /* Transport controls */
        .nf-ctl {
          width: 38px; height: 38px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);
          color: rgba(255,255,255,0.75); cursor: pointer;
          transition: all 0.18s ease;
          min-height: unset;
        }
        .nf-ctl:hover { background: rgba(255,255,255,0.2); color: #fff; transform: scale(1.08); }
        .nf-ctl:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }

        @media (max-width: 767px) {
          /* Centre the indicator and lift it clear of the floating tab bar,
             which previously covered the dots. */
          .nf-strip {
            justify-content: center;
            padding: 0 1rem calc(72px + env(safe-area-inset-bottom, 0px));
          }
          .nf-strip-left { gap: 0.625rem; }
          .nf-strip-right { display: none; }
          .nf-counter { display: none; }
          .nf-dots { gap: 0.4rem; }
          .nf-dot { width: 8px; height: 8px; border-radius: 999px; }
          .nf-dot--active { width: 32px; border-radius: 999px; }
        }

        /* Reduced motion */
        @media (prefers-reduced-motion: reduce) {
          .nf-bg { transition: none; }
          .nf-bg--active .nf-bg-img { animation: none; }
          .nf-content > * { animation: none; opacity: 1; transform: none; }
          .nf-dot--active .nf-dot-fill { animation: none; transform: scaleX(1); }
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
