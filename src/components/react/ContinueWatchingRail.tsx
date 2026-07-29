import { useEffect, useState } from 'react';
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
 * "Continue Watching" rail. Prefers real playback history recorded by the
 * players (localStorage `filmora_continue`); if the visitor hasn't watched
 * anything yet it falls back to their saved watchlist so the rail is still
 * useful. Renders nothing until mounted and only when there is something to
 * show — so it never causes an SSR/CSR mismatch.
 */
export default function ContinueWatchingRail({ title = 'Continue Watching' }: { title?: string }) {
  const [items, setItems] = useState<RailItem[] | null>(null);
  // Which store the rail ended up rendering — decides where "View all" goes.
  const [source, setSource] = useState<'continue' | 'watchlist'>('continue');

  useEffect(() => {
    const load = () => {
      try {
        const cont = getContinueWatching();
        if (cont.length > 0) {
          setSource('continue');
          setItems(
            cont.slice(0, 20).map((e: ContinueEntry) => ({
              id: e.id,
              mediaType: e.mediaType,
              title: e.title,
              posterUrl: e.posterUrl,
              sub: e.mediaType === 'tv' && e.season && e.episode ? `S${e.season} · E${e.episode}` : null,
            }))
          );
          return;
        }
        // Fallback: saved watchlist.
        const wl = JSON.parse(localStorage.getItem('filmora_watchlist') || '[]') as WatchItem[];
        const sorted = [...wl].sort((a, b) => (b.addedAt ?? '').localeCompare(a.addedAt ?? ''));
        setSource('watchlist');
        setItems(sorted.slice(0, 20).map((it) => ({ ...it, sub: null })));
      } catch {
        setItems([]);
      }
    };
    load();
    window.addEventListener('filmora:continue-updated', load);
    return () => window.removeEventListener('filmora:continue-updated', load);
  }, []);

  if (!items || items.length === 0) return null;

  return (
    <section className="rail cw-rail" aria-label={title}>
      <div className="container">
        <div className="rail-header">
          <h2 className="rail-title">{title}</h2>
          <a
            href={source === 'continue' ? '/continue' : '/watchlist'}
            className="rail-view-all"
            aria-label={source === 'continue' ? 'View all continue watching' : 'View all watchlist'}
          >
            View all
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
          </a>
        </div>
        <div className="cw-marquee">
          {/* Two identical sequences make the left→right roll seamless. */}
          <div className="cw-track" role="list" aria-hidden={false}>
            {items.concat(items).map((it, i) => {
              const href = it.mediaType === 'movie' ? `/movie/${it.id}#watch` : `/series/${it.id}#watch`;
              const isClone = i >= items.length;
              return (
                <div
                  role={isClone ? 'presentation' : 'listitem'}
                  aria-hidden={isClone ? true : undefined}
                  key={`${it.mediaType}-${it.id}-${i}`}
                  className="cw-card"
                >
                  <a
                    href={href}
                    className="cw-link"
                    aria-label={`Resume ${it.title}`}
                    tabIndex={isClone ? -1 : undefined}
                  >
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
      </div>

      <style>{`
        .cw-rail { margin-bottom: 0; }
        .rail-header { display:flex; align-items:baseline; justify-content:space-between; gap:1rem; margin-bottom:1rem; }
        .rail-title { font-size: var(--font-size-xl); font-weight:600; color:var(--color-text); letter-spacing:var(--letter-spacing-tight); margin:0; }
        .rail-view-all { display:inline-flex; align-items:center; gap:0.25rem; font-size:var(--font-size-sm); color:var(--color-text-3); text-decoration:none; white-space:nowrap; transition:color 150ms ease; }
        .rail-view-all:hover { color: var(--color-text); }

        /* ─── Auto-rolling marquee (left → right) ─── */
        .cw-marquee {
          overflow: hidden;
          /* Soft fade on both edges so cards ease in/out of view. */
          -webkit-mask-image: linear-gradient(to right, transparent, #000 4%, #000 96%, transparent);
          mask-image: linear-gradient(to right, transparent, #000 4%, #000 96%, transparent);
        }
        .cw-track {
          display: flex;
          gap: 1rem;
          width: max-content;
          /* Slide one full sequence to the left → cards travel right→left. */
          animation: cw-roll 45s linear infinite;
          will-change: transform;
        }
        .cw-marquee:hover .cw-track { animation-play-state: paused; }
        @keyframes cw-roll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .cw-track { animation: none; transform: none; }
        }

        .cw-card { flex-shrink:0; width:160px; }
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
          .cw-card { width: 120px; }
          .cw-title { font-size: 0.75rem; }
        }
      `}</style>
    </section>
  );
}
