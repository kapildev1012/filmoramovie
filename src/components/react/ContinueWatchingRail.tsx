import { useCallback, useEffect, useRef, useState } from 'react';
import { getContinueWatching, type ContinueEntry } from '../../lib/continueWatching';

interface WatchItem {
  id: number;
  mediaType: 'movie' | 'tv';
  title: string;
  posterUrl: string | null;
  addedAt?: string;
}

interface RailItem {
  id: number;
  mediaType: 'movie' | 'tv';
  title: string;
  posterUrl: string | null;
  /** Sub-label e.g. "S1 · E3" for series in progress. */
  sub?: string | null;
}

/**
 * "Continue Watching" rail — auto-scrolls left → right (marquee style),
 * pauses on hover/touch, and loops seamlessly by duplicating the item set.
 */
export default function ContinueWatchingRail({ title = 'Continue Watching' }: { title?: string }) {
  const [items, setItems] = useState<RailItem[] | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const pausedRef = useRef(false);
  const speedRef = useRef(0.5); // px per frame (~30px/s at 60fps)

  useEffect(() => {
    const load = () => {
      try {
        const cont = getContinueWatching();
        if (cont.length > 0) {
          setItems(
            cont.slice(0, 20).map((e: ContinueEntry) => ({
              id: e.id,
              mediaType: e.mediaType,
              title: e.title,
              posterUrl: e.posterUrl,
              sub: e.mediaType === 'tv' && e.season && e.episode ? `Season ${e.season} · Episode ${e.episode}` : null,
            }))
          );
          return;
        }
        // Fallback: saved watchlist.
        const wl = JSON.parse(localStorage.getItem('filmora_watchlist') || '[]') as WatchItem[];
        const sorted = [...wl].sort((a, b) => (b.addedAt ?? '').localeCompare(a.addedAt ?? ''));
        setItems(sorted.slice(0, 20).map((it) => ({ ...it, sub: null })));
      } catch {
        setItems([]);
      }
    };
    load();
    window.addEventListener('filmora:continue-updated', load);
    return () => window.removeEventListener('filmora:continue-updated', load);
  }, []);

  // Auto-scroll loop: translates the track and resets seamlessly at midpoint.
  const animate = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    if (!pausedRef.current) {
      const max = track.scrollWidth / 2; // half = one full set of items
      track.scrollLeft += speedRef.current;
      if (track.scrollLeft >= max) {
        track.scrollLeft -= max;
      }
    }
    rafRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    if (!items || items.length === 0) return;
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [items, animate]);

  const pause = useCallback(() => { pausedRef.current = true; }, []);
  const resume = useCallback(() => { pausedRef.current = false; }, []);

  if (!items || items.length === 0) return null;

  // Duplicate items for seamless infinite scroll
  const doubled = [...items, ...items];

  return (
    <section className="rail cw-rail" aria-label={title}>
      <div className="container">
        <div className="cw-header">
          <h2 className="rail-title">{title}</h2>
        </div>
        <div
          className="cw-track"
          ref={trackRef}
          role="list"
          onMouseEnter={pause}
          onMouseLeave={resume}
          onTouchStart={pause}
          onTouchEnd={resume}
        >
          {doubled.map((it, i) => {
            const href = it.mediaType === 'movie' ? `/movie/${it.id}#watch` : `/series/${it.id}#watch`;
            return (
              <div role="listitem" key={`${it.mediaType}-${it.id}-${i}`} className="cw-card">
                <a href={href} className="cw-link" aria-label={`Resume ${it.title}`}>
                  <div className="cw-img-wrap">
                    {it.posterUrl ? (
                      <img src={it.posterUrl} alt="" className="cw-img" loading="lazy" decoding="async" />
                    ) : (
                      <div className="cw-placeholder">{it.title}</div>
                    )}
                    <span className="cw-resume" aria-hidden="true">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                    </span>
                    {it.sub && <span className="cw-sub">{it.sub}</span>}
                  </div>
                  <h3 className="cw-title">{it.title}</h3>
                </a>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        .cw-rail { margin-bottom: 0; }
        .cw-header { margin-bottom: 0.75rem; }
        .rail-title { font-size: var(--font-size-xl); font-weight:600; color:var(--color-text); letter-spacing:var(--letter-spacing-tight); margin:0; }

        /* Roller track: horizontal scroll hidden, items flow in a row */
        .cw-track {
          display: flex;
          gap: 0.75rem;
          overflow-x: hidden;
          scrollbar-width: none;
          -ms-overflow-style: none;
          -webkit-overflow-scrolling: touch;
        }
        .cw-track::-webkit-scrollbar { display: none; }

        .cw-card { flex-shrink:0; width:140px; }
        .cw-link { display:block; text-decoration:none; color:inherit; }
        .cw-img-wrap {
          position:relative; border-radius:var(--radius-lg); overflow:hidden;
          background:var(--color-surface-2); aspect-ratio:2/3;
          transition: transform .25s var(--ease-out-fast), box-shadow .25s var(--ease-out-fast);
        }
        .cw-card:hover .cw-img-wrap { transform: translateY(-4px); box-shadow: 0 16px 40px rgba(0,0,0,0.5); }
        .cw-img { width:100%; height:100%; object-fit:cover; display:block; }
        .cw-placeholder { width:100%; height:100%; display:flex; align-items:center; justify-content:center; padding:1rem; font-size:0.75rem; color:var(--color-text-3); text-align:center; }
        .cw-resume {
          position:absolute; inset:0; margin:auto; width:48px; height:48px; border-radius:50%;
          display:flex; align-items:center; justify-content:center; color:#fff;
          background:rgba(0,0,0,0.55); backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px);
          border:1px solid rgba(255,255,255,0.3);
          opacity:0; transform:scale(0.8); transition:all .2s var(--ease-out-fast);
        }
        .cw-card:hover .cw-resume { opacity:1; transform:scale(1); }
        .cw-sub {
          position:absolute; left:0; right:0; bottom:0; padding:0.35rem 0.5rem;
          font-size:0.7rem; font-weight:700; color:#fff; letter-spacing:0.03em;
          background:linear-gradient(to top, rgba(0,0,0,0.85), transparent);
        }
        .cw-title { font-size:var(--font-size-sm); font-weight:500; color:var(--color-text); margin:0.5rem 0 0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        @media (max-width: 767px) {
          .cw-card { width: clamp(100px, 28vw, 140px); }
          .cw-title { font-size: clamp(0.6875rem, 2vw, 0.8125rem); }
          .cw-track { gap: clamp(0.75rem, 3.5vw, 1.125rem); }
        }
        @media (prefers-reduced-motion: reduce) {
          .cw-track { overflow-x: auto; }
        }
      `}</style>
    </section>
  );
}
