import { useState, useEffect, useCallback, useRef } from 'react';
import type { HeroSlide } from '../../lib/tmdb';
import { AnimatedLayerButton } from '../ui/button';

/** Time each slide stays on screen. Long enough to read the 2–3 line overview. */
const SLIDE_MS = 6000;

/**
 * Layout presets.
 *
 * Every page used to get the same 100svh hero, which meant a browse grid or a
 * detail page's player started a full viewport below the fold. The variant only
 * changes the height ladder + bottom chrome — typography, gutters and gradients
 * stay identical so the hero reads the same everywhere.
 *
 *  full   → home page: full-bleed showcase
 *  page   → browse / platform hubs: shorter, so the content below peeks in
 *  detail → movie & series detail: single slide, no carousel chrome
 */
export type HeroVariant = 'full' | 'page' | 'detail';

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
  /** Layout preset — defaults to `full`. */
  variant?: HeroVariant;
}

export default function HeroCarousel({ slides, label, variant = 'full' }: Props) {
  const count = slides.length;
  const isCarousel = count > 1;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  // Drag-follow feedback. Written to directly (not via state) so a swipe tracks
  // at 60fps instead of re-rendering the whole hero on every touchmove.
  const bodyInnerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const dragDX = useRef(0);

  const goTo = useCallback((i: number) => {
    if (count === 0) return;
    setIndex(((i % count) + count) % count);
  }, [count]);

  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1), [goTo, index]);

  // Slide list can change length between renders (client nav / fresh data).
  useEffect(() => {
    if (index > count - 1) setIndex(0);
  }, [count, index]);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(mq.matches);
    const handler = () => setReduceMotion(mq.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  const autoplayOff = paused || userPaused || reduceMotion || !isCarousel;

  // Autoplay — pause on hover/focus/touch, on explicit request, or reduced motion.
  useEffect(() => {
    if (autoplayOff) return;
    const id = window.setTimeout(next, SLIDE_MS);
    return () => window.clearTimeout(id);
  }, [index, autoplayOff, next]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isCarousel) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
    else if (e.key === 'Home') { e.preventDefault(); goTo(0); }
    else if (e.key === 'End') { e.preventDefault(); goTo(count - 1); }
  }, [isCarousel, next, prev, goTo, count]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    dragging.current = false;
    dragDX.current = 0;
    setPaused(true); // don't advance while the user is interacting
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;

    // Lock the gesture axis on first meaningful movement: a vertical swipe is
    // a page scroll and must be handed back to the browser, a horizontal one
    // is ours to drive.
    if (!dragging.current) {
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
        touchStartX.current = null;
        touchStartY.current = null;
        return;
      }
      if (Math.abs(dx) > 12) {
        dragging.current = true;
        const body = bodyInnerRef.current;
        const stage = stageRef.current;
        if (body) body.style.transition = 'none';
        if (stage) stage.style.transition = 'none';
      } else {
        return;
      }
    }

    dragDX.current = dx;
    if (reduceMotion || !isCarousel) return; // track the swipe, skip the motion

    // Damped follow so the copy trails the finger without sliding off-screen,
    // plus a subtle backdrop parallax — makes the slide feel physically grabbed.
    const body = bodyInnerRef.current;
    const stage = stageRef.current;
    if (body) {
      body.style.transform = `translateX(${dx * 0.35}px)`;
      body.style.opacity = String(Math.max(0.35, 1 - Math.abs(dx) / 420));
    }
    if (stage) stage.style.transform = `translateX(${dx * 0.045}px)`;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    setPaused(false);
    const startedX = touchStartX.current;
    const startedY = touchStartY.current;
    const dx = dragDX.current;

    // Spring copy + backdrop back to rest. If we commit to a slide below, the
    // opacity crossfade takes over while this spring runs.
    const body = bodyInnerRef.current;
    const stage = stageRef.current;
    if (body) {
      body.style.transition = 'transform 0.4s cubic-bezier(0.22,1,0.36,1), opacity 0.3s ease';
      body.style.transform = '';
      body.style.opacity = '';
    }
    if (stage) {
      stage.style.transition = 'transform 0.5s cubic-bezier(0.22,1,0.36,1)';
      stage.style.transform = '';
    }

    dragging.current = false;
    dragDX.current = 0;
    touchStartX.current = null;
    touchStartY.current = null;

    if (startedX === null || startedY === null) return;
    const dy = e.changedTouches[0].clientY - startedY;
    // Commit when the gesture is clearly horizontal and past a width-scaled
    // threshold (short on phones, never runaway on tablets).
    const threshold = Math.min(64, window.innerWidth * 0.16);
    if (Math.abs(dx) > threshold && Math.abs(dx) > Math.abs(dy) * 1.4) {
      (dx < 0 ? next : prev)();
    }
  };

  if (count === 0) return null;

  const slide = slides[Math.min(index, count - 1)];
  const facts = [slide.releaseYear, slide.runtime].filter(Boolean) as string[];

  return (
    <section
      className={`nf-hero nf-hero--${variant}${isCarousel ? '' : ' nf-hero--single'}`}
      aria-roledescription={isCarousel ? 'carousel' : undefined}
      aria-label={label ? `${label}${isCarousel ? ' carousel' : ''}` : 'Featured content'}
      tabIndex={isCarousel ? 0 : -1}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={onKeyDown}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* ── Layer 1: backdrop ──
          Only mount the active and adjacent images. Absolutely positioned lazy
          images all count as in-viewport, so mounting every slide fetched every
          w1280 backdrop immediately. */}
      <div className="nf-stage" ref={stageRef} aria-hidden="true">
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
        {/* One element, three stacked gradients: top scrim (nav legibility),
            left vignette (desktop copy) and bottom fade into the page. */}
        <div className="nf-veil" />
      </div>

      {/* ── Layer 2: copy — aligned to the same grid as .container ── */}
      <div className="nf-body">
        <div className="nf-inner" ref={bodyInnerRef}>
          <div
            className="nf-copy"
            key={`copy-${slide.id}`}
            role="group"
            aria-roledescription={isCarousel ? 'slide' : undefined}
            aria-label={isCarousel ? `${index + 1} of ${count}: ${slide.title}` : undefined}
          >
            <div className="nf-meta">
              <span className="nf-kind">{slide.mediaType === 'movie' ? 'Movie' : 'Series'}</span>
              {slide.rating > 0 && (
                <span className="nf-imdb">
                  <span className="nf-imdb-mark">IMDb</span>
                  {slide.rating.toFixed(1)}
                </span>
              )}
              {facts.map((f) => <span className="nf-fact" key={f}>{f}</span>)}
            </div>

            <h1 className="nf-title">{slide.title}</h1>

            {slide.genres.length > 0 && (
              <p className="nf-genres">
                {slide.genres.slice(0, 3).map((g) => (
                  <span className="nf-genre" key={g}>{g}</span>
                ))}
              </p>
            )}

            {slide.overview && <p className="nf-overview">{slide.overview}</p>}

            <div className="nf-actions">
              <AnimatedLayerButton 
                onClick={() => window.location.href = slide.href}
                className="flex-1 md:flex-none w-full md:w-[240px] gap-2"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M6 4.75a.75.75 0 0 1 1.18-.61l12 7.25a.75.75 0 0 1 0 1.22l-12 7.25A.75.75 0 0 1 6 19.25V4.75z" />
                </svg>
                <span>Play</span>
              </AnimatedLayerButton>
              <div className="flex-1 md:hidden">
                <WatchlistBtn id={slide.id} mediaType={slide.mediaType} title={slide.title} posterUrl={slide.posterUrl} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Layer 3: carousel chrome — only when there is something to page ── */}
      {isCarousel && (
        <div className="nf-strip">
          <div className="nf-inner nf-strip-row">
            <div className="nf-dots" role="group" aria-label="Choose slide">
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  aria-label={`Slide ${i + 1} of ${count}: ${s.title}`}
                  aria-current={i === index ? 'true' : undefined}
                  className={`nf-dot ${i === index ? 'nf-dot--active' : ''}`}
                  onClick={() => goTo(i)}
                >
                  {i === index && !autoplayOff && (
                    <span className="nf-dot-fill" key={`fill-${index}`} />
                  )}
                </button>
              ))}
            </div>

            <div className="nf-nav">
              <span className="nf-counter" aria-hidden="true">
                <b>{String(index + 1).padStart(2, '0')}</b> / {String(count).padStart(2, '0')}
              </span>
              <button type="button" className="nf-icon-btn" onClick={prev} aria-label="Previous slide">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
              </button>
              <button
                type="button"
                className="nf-icon-btn"
                onClick={() => setUserPaused((p) => !p)}
                aria-label={userPaused ? 'Resume automatic slide rotation' : 'Pause automatic slide rotation'}
              >
                {userPaused
                  ? <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.75a.75.75 0 0 1 1.18-.61l11 7.25a.75.75 0 0 1 0 1.22l-11 7.25A.75.75 0 0 1 7 19.25V4.75z" /></svg>
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>}
              </button>
              <button type="button" className="nf-icon-btn" onClick={next} aria-label="Next slide">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        /* ════════════════════════════════════════════════════════════
           HERO CAROUSEL — single source of truth.
           Every rule is scoped under .nf-hero so page-level styles and
           the global .nf-* player classes can never collide with it.
           Sizing is driven by custom properties, so a page only needs a
           variant class to change the layout.
        ════════════════════════════════════════════════════════════ */
        .nf-hero {
          /* Gutters mirror .container exactly, so the hero title lines up with
             the rail titles below it:
               ≤1023px → var(--mob-pad-x)  (mobile.css)
               ≥1024px → 2.5rem            (global.css)
               ≥1280px → 4rem              (global.css)   */
          --nf-gutter: var(--mob-pad-x, 1.5rem);
          --nf-max: 1440px;
          --nf-h: 100svh;
          --nf-copy: 40rem;
          --nf-pad-b: 0px;
          --nf-slide-ms: ${SLIDE_MS}ms;

          position: relative;
          display: grid;
          grid-template-rows: 1fr auto;
          width: 100%;
          min-height: var(--nf-h);
          padding-bottom: var(--nf-pad-b);
          overflow: hidden;
          background: #000;
          outline: none;
          touch-action: pan-y; /* allow vertical scroll; we handle horizontal swipes */
        }
        .nf-hero:focus-visible {
          outline: 2px solid rgba(255,255,255,0.7);
          outline-offset: -4px;
        }

        /* ── Variants ──────────────────────────────────────────── */
        .nf-hero--page   { --nf-h: 76svh; }
        .nf-hero--detail { --nf-h: 82svh; }

        /* ── 1. Backdrop ──────────────────────────────────────── */
        .nf-hero .nf-stage { position: absolute; inset: 0; z-index: 0; }
        .nf-hero .nf-bg {
          position: absolute; inset: 0;
          opacity: 0; transition: opacity 900ms ease; will-change: opacity;
        }
        .nf-hero .nf-bg--active { opacity: 1; }
        .nf-hero .nf-bg-img {
          width: 100%; height: 100%; display: block;
          object-fit: cover; object-position: center 20%;
        }
        .nf-hero .nf-bg--active .nf-bg-img { animation: nf-kenburns 8s ease-out forwards; }

        .nf-hero .nf-veil {
          position: absolute; inset: 0; pointer-events: none;
          background:
            /* top scrim — keeps the floating nav readable */
            linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 140px),
            /* left vignette — carries the left-aligned copy */
            linear-gradient(to right, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.45) 35%, transparent 65%),
            /* bottom fade — hands off to the page background */
            linear-gradient(to top, #000 0%, rgba(0,0,0,0.9) 18%, rgba(0,0,0,0.5) 45%, rgba(0,0,0,0.1) 75%, transparent 100%);
        }

        /* ── Shared horizontal rhythm ─────────────────────────── */
        .nf-hero .nf-inner {
          width: 100%;
          max-width: var(--nf-max);
          margin-inline: auto;
          padding-inline: var(--nf-gutter);
        }

        /* ── 2. Copy ──────────────────────────────────────────── */
        .nf-hero .nf-body {
          grid-row: 1;
          align-self: end;
          position: relative;
          z-index: 2;
          padding-block-end: clamp(1.5rem, 4vh, 3rem);
        }
        .nf-hero .nf-copy { max-width: var(--nf-copy); }
        /* No carousel chrome below the copy, so give it the strip's breathing room. */
        .nf-hero--single .nf-body { padding-block-end: clamp(2rem, 6vh, 4rem); }

        /* Meta row — one separator rule instead of per-pair overrides */
        .nf-hero .nf-meta {
          display: flex; align-items: center; flex-wrap: wrap;
          gap: 0.5rem;
          margin: 0 0 0.75rem;
          animation: nf-fade-up 0.5s ease backwards; animation-delay: 60ms;
        }
        .nf-hero .nf-meta > * + *::before {
          content: '';
          display: inline-block;
          width: 3px; height: 3px; border-radius: 50%;
          background: rgba(255,255,255,0.4);
          margin-right: 0.5rem;
          vertical-align: middle;
        }
        .nf-hero .nf-kind {
          font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.08em;
          text-transform: uppercase; color: rgba(255,255,255,0.75);
        }
        .nf-hero .nf-imdb {
          display: inline-flex; align-items: center; gap: 0.35rem;
          font-size: 0.875rem; font-weight: 700; color: #fff;
        }
        .nf-hero .nf-imdb-mark {
          background: #f5c518; color: #000; font-weight: 900; font-size: 0.65rem;
          padding: 0.1rem 0.3rem; border-radius: 3px; letter-spacing: 0.02em;
        }
        .nf-hero .nf-fact { font-size: 0.8125rem; font-weight: 500; color: rgba(255,255,255,0.65); }

        .nf-hero .nf-title {
          font-size: clamp(2rem, 4.6vw, 3.75rem);
          font-weight: 700; line-height: 1.05; letter-spacing: -0.025em;
          color: #fff; margin: 0 0 0.625rem;
          text-shadow: 0 2px 24px rgba(0,0,0,0.7);
          text-wrap: balance;
          animation: nf-fade-up 0.5s ease backwards; animation-delay: 100ms;
        }

        /* Genres — dot separated on every breakpoint (was borders on desktop,
           dots on mobile, which read as two different components). */
        .nf-hero .nf-genres {
          display: flex; flex-wrap: wrap; align-items: center;
          gap: 0.5rem; margin: 0 0 0.875rem;
          animation: nf-fade-up 0.5s ease backwards; animation-delay: 130ms;
        }
        .nf-hero .nf-genre {
          font-size: 0.75rem; font-weight: 500; letter-spacing: 0.03em;
          color: rgba(255,255,255,0.7);
        }
        .nf-hero .nf-genre + .nf-genre::before {
          content: '•'; margin-right: 0.5rem; color: rgba(255,255,255,0.35);
        }

        .nf-hero .nf-overview {
          font-size: clamp(0.875rem, 1.3vw, 1rem);
          line-height: 1.55;
          color: rgba(255,255,255,0.78);
          margin: 0 0 1.375rem;
          max-width: 58ch;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
          animation: nf-fade-up 0.5s ease backwards; animation-delay: 160ms;
        }

        /* Actions — same shape on every breakpoint, only the sizing changes */
        .nf-hero .nf-actions {
          display: flex; align-items: stretch; flex-wrap: wrap;
          gap: 0.625rem;
          animation: nf-fade-up 0.5s ease backwards; animation-delay: 200ms;
        }
        .nf-hero .nf-btn {
          display: inline-flex; align-items: center; justify-content: center;
          gap: 0.5rem;
          min-height: 46px; padding: 0.6rem 1.5rem;
          font-size: 0.9375rem; font-weight: 700; line-height: 1;
          border: none; border-radius: 8px;
          text-decoration: none; white-space: nowrap; cursor: pointer;
          transition: background-color 0.15s ease, color 0.15s ease, transform 0.15s ease;
        }
        .nf-hero .nf-btn:active { transform: scale(0.98); }
        .nf-hero .nf-btn--play { background: #fff; color: #000; box-shadow: 0 4px 16px rgba(0,0,0,0.4); }
        .nf-hero .nf-btn--play:hover { background: rgba(255,255,255,0.85); }
        .nf-hero .nf-btn--wl {
          background: rgba(109,109,110,0.5); color: #fff;
          -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
        }
        .nf-hero .nf-btn--wl:hover { background: rgba(109,109,110,0.7); }
        .nf-hero .nf-btn--wl--saved { color: #ff5661; }

        /* ── 3. Carousel chrome ───────────────────────────────── */
        .nf-hero .nf-strip {
          grid-row: 2;
          position: relative; z-index: 3;
          padding-block: 0.5rem 1.25rem;
        }
        .nf-hero .nf-strip-row {
          display: flex; align-items: center; justify-content: space-between;
          gap: 1rem;
        }
        .nf-hero .nf-dots { display: flex; align-items: center; gap: 0.375rem; }
        .nf-hero .nf-dot {
          position: relative; overflow: hidden;
          display: block; min-height: unset;
          width: 20px; height: 3px; padding: 0;
          border: none; border-radius: 2px;
          background: rgba(255,255,255,0.3);
          cursor: pointer;
          transition: width 0.3s ease, background-color 0.3s ease;
        }
        .nf-hero .nf-dot::after {
          /* invisible 44px tap target without inflating the visual dot */
          content: ''; position: absolute; inset: -20px -3px;
        }
        .nf-hero .nf-dot--active { width: 44px; background: rgba(255,255,255,0.35); }
        .nf-hero .nf-dot-fill {
          position: absolute; inset: 0; transform-origin: left center;
          background: #fff;
          animation: nf-dot-fill var(--nf-slide-ms) linear forwards;
        }

        .nf-hero .nf-nav { display: flex; align-items: center; gap: 0.5rem; }
        .nf-hero .nf-counter {
          font-size: 0.75rem; font-variant-numeric: tabular-nums;
          letter-spacing: 0.08em; color: rgba(255,255,255,0.5);
          margin-right: 0.25rem;
        }
        .nf-hero .nf-counter b { color: #fff; font-weight: 700; }
        .nf-hero .nf-icon-btn {
          display: flex; align-items: center; justify-content: center;
          width: 38px; height: 38px; padding: 0;
          border-radius: 50%;
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.2);
          color: rgba(255,255,255,0.75);
          cursor: pointer;
          transition: background-color 0.18s ease, color 0.18s ease;
        }
        .nf-hero .nf-icon-btn:hover { background: rgba(255,255,255,0.22); color: #fff; }

        /* ════════ Tablet (768–1023px) ════════ */
        @media (min-width: 768px) and (max-width: 1023px) {
          .nf-hero { --nf-h: 74svh; --nf-copy: 34rem; }
          .nf-hero--page   { --nf-h: 62svh; }
          .nf-hero--detail { --nf-h: 68svh; }
        }

        /* ════════ Desktop (≥1024px) ════════ */
        @media (min-width: 1024px) { .nf-hero { --nf-gutter: 2.5rem; } }
        @media (min-width: 1280px) { .nf-hero { --nf-gutter: 4rem; --nf-copy: 44rem; } }

        /* ════════ Mobile (≤767px) ════════
           Copy centres, the left vignette is dropped (it only helps
           left-aligned desktop copy) and the bottom chrome clears the
           floating tab bar + notch. */
        @media (max-width: 767px) {
          .nf-hero {
            --nf-h: 88svh;
            --nf-copy: 100%;
            --nf-pad-b: calc(var(--mob-tab-h, 60px) + env(safe-area-inset-bottom, 0px) + 0.75rem);
          }
          .nf-hero--page   { --nf-h: 78svh; }
          .nf-hero--detail { --nf-h: 80svh; }

          .nf-hero .nf-veil {
            background:
              linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 110px),
              linear-gradient(to top, #000 0%, rgba(0,0,0,0.94) 24%, rgba(0,0,0,0.6) 52%, rgba(0,0,0,0.15) 80%, transparent 100%);
          }
          .nf-hero .nf-bg-img { object-position: center 18%; }

          .nf-hero .nf-body { padding-block-end: clamp(0.75rem, 2vh, 1.25rem); }
          .nf-hero--single .nf-body { padding-block-end: clamp(1.25rem, 3vh, 2rem); }
          .nf-hero .nf-copy {
            display: flex; flex-direction: column; align-items: center;
            text-align: center;
          }
          .nf-hero .nf-title { font-size: clamp(1.5rem, 6.6vw, 2.25rem); }
          .nf-hero .nf-meta,
          .nf-hero .nf-genres { justify-content: center; }
          .nf-hero .nf-overview { -webkit-line-clamp: 2; margin-bottom: 1.125rem; }

          .nf-hero .nf-actions {
            flex-wrap: nowrap;
            width: 100%; max-width: 26rem;
            gap: 0.625rem;
          }
          .nf-hero .nf-btn {
            flex: 1 1 0; min-width: 0;
            min-height: 50px; padding: 0.75rem 1rem;
            border-radius: 10px;
          }

          .nf-hero .nf-strip { padding-block: 0.25rem 0.5rem; }
          /* Dots only — arrows and the counter are redundant next to swipe. */
          .nf-hero .nf-strip-row { justify-content: center; }
          .nf-hero .nf-nav { display: none; }
          .nf-hero .nf-dots { gap: 0.4375rem; }
          .nf-hero .nf-dot { width: 16px; height: 2px; }
          .nf-hero .nf-dot--active { width: 34px; }
        }

        /* ── Motion ───────────────────────────────────────────── */
        @keyframes nf-fade-up {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes nf-kenburns {
          from { transform: scale(1.06); }
          to   { transform: scale(1); }
        }
        @keyframes nf-dot-fill {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .nf-hero .nf-bg { transition: none; }
          .nf-hero .nf-bg--active .nf-bg-img { animation: none; }
          .nf-hero .nf-copy > * { animation: none; opacity: 1; transform: none; }
          .nf-hero .nf-dot-fill { animation: none; }
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
      type="button"
      className={`nf-btn nf-btn--wl ${saved ? 'nf-btn--wl--saved' : ''}`}
      onClick={toggle}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${title} from watchlist` : `Add ${title} to watchlist`}
      title={saved ? 'Remove from Watchlist' : 'Add to Watchlist'}
    >
      {saved
        ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
        : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
      }
      <span className="nf-btn-text">My List</span>
    </button>
  );
}
