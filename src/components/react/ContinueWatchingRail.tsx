import { useEffect, useState } from 'react';

interface WatchItem {
  id: number;
  mediaType: 'movie' | 'tv';
  title: string;
  posterUrl: string | null;
  addedAt?: string;
}

/**
 * Personalized rail sourced from the browser's watchlist (localStorage).
 * Renders nothing until mounted and only if the user has saved items — so it
 * never causes SSR/CSR mismatch and stays out of the way for new visitors.
 */
export default function ContinueWatchingRail({ title = 'From Your Watchlist' }: { title?: string }) {
  const [items, setItems] = useState<WatchItem[] | null>(null);

  useEffect(() => {
    try {
      const wl = JSON.parse(localStorage.getItem('filmora_watchlist') || '[]') as WatchItem[];
      const sorted = [...wl].sort((a, b) => (b.addedAt ?? '').localeCompare(a.addedAt ?? ''));
      setItems(sorted.slice(0, 20));
    } catch {
      setItems([]);
    }
  }, []);

  if (!items || items.length === 0) return null;

  return (
    <section className="rail cw-rail" aria-label={title}>
      <div className="container">
        <div className="rail-header">
          <h2 className="rail-title">{title}</h2>
          <a href="/watchlist" className="rail-view-all" aria-label="View all watchlist">
            View all
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
          </a>
        </div>
        <div className="scroll-rail" role="list">
          {items.map((it) => {
            const href = it.mediaType === 'movie' ? `/movie/${it.id}` : `/series/${it.id}`;
            return (
              <div role="listitem" key={`${it.mediaType}-${it.id}`} className="cw-card">
                <a href={href} className="cw-link" aria-label={it.title}>
                  <div className="cw-img-wrap">
                    {it.posterUrl ? (
                      <img src={it.posterUrl} alt="" className="cw-img" loading="lazy" decoding="async" />
                    ) : (
                      <div className="cw-placeholder">{it.title}</div>
                    )}
                    <span className="cw-resume" aria-hidden="true">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                    </span>
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
        .rail-header { display:flex; align-items:baseline; justify-content:space-between; gap:1rem; margin-bottom:1rem; }
        .rail-title { font-size: var(--font-size-xl); font-weight:600; color:var(--color-text); letter-spacing:var(--letter-spacing-tight); margin:0; }
        .rail-view-all { display:inline-flex; align-items:center; gap:0.25rem; font-size:var(--font-size-sm); color:var(--color-text-3); text-decoration:none; white-space:nowrap; transition:color 150ms ease; }
        .rail-view-all:hover { color: var(--color-text); }
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
        .cw-title { font-size:var(--font-size-sm); font-weight:500; color:var(--color-text); margin:0.5rem 0 0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        @media (max-width: 767px) {
          .cw-card { width: 120px; }
          .cw-title { font-size: 0.75rem; }
        }
      `}</style>
    </section>
  );
}
