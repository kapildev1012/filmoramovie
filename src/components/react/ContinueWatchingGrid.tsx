import { useEffect, useMemo, useState } from 'react';
import {
  getContinueWatching,
  removeContinueWatching,
  type ContinueEntry,
} from '../../lib/continueWatching';

type Filter = 'all' | 'movie' | 'tv';

function pct(e: ContinueEntry): number | null {
  if (!e.positionSeconds || !e.durationSeconds || e.durationSeconds <= 0) return null;
  return Math.min(100, Math.max(1, Math.round((e.positionSeconds / e.durationSeconds) * 100)));
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function resumeHref(e: ContinueEntry): string {
  const base = e.mediaType === 'movie' ? `/movie/${e.id}` : `/series/${e.id}`;
  const params = new URLSearchParams();
  if (e.mediaType === 'tv' && e.season && e.episode) {
    params.set('s', String(e.season));
    params.set('e', String(e.episode));
  }
  if (e.positionSeconds && e.positionSeconds > 5) params.set('t', String(Math.floor(e.positionSeconds)));
  const qs = params.toString();
  return `${base}${qs ? `?${qs}` : ''}#watch`;
}

/**
 * Full "Continue Watching" page body. The history lives in localStorage, so the
 * whole list has to be built on the client — `entries === null` is the
 * pre-mount state and renders a skeleton rather than a wrong empty state.
 */
export default function ContinueWatchingGrid() {
  const [entries, setEntries] = useState<ContinueEntry[] | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    const load = () => setEntries(getContinueWatching());
    load();
    window.addEventListener('filmora:continue-updated', load);
    return () => window.removeEventListener('filmora:continue-updated', load);
  }, []);

  const counts = useMemo(() => ({
    all: entries?.length ?? 0,
    movie: entries?.filter((e) => e.mediaType === 'movie').length ?? 0,
    tv: entries?.filter((e) => e.mediaType === 'tv').length ?? 0,
  }), [entries]);

  const visible = useMemo(() => {
    if (!entries) return [];
    const term = query.trim().toLowerCase();
    return entries
      .filter((e) => filter === 'all' || e.mediaType === filter)
      .filter((e) => !term || e.title.toLowerCase().includes(term));
  }, [entries, filter, query]);

  const remove = (e: ContinueEntry) => {
    removeContinueWatching(e.id, e.mediaType);
    setEntries(getContinueWatching());
  };

  const clearAll = () => {
    if (!window.confirm('Clear your entire Continue Watching history?')) return;
    (entries ?? []).forEach((e) => removeContinueWatching(e.id, e.mediaType));
    setEntries(getContinueWatching());
  };

  if (entries === null) {
    return (
      <div className="cwp-grid" aria-busy="true" aria-label="Loading your history">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="cwp-skeleton" />
        ))}
        <Styles />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="cwp-empty">
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="cwp-empty-icon">
          <circle cx="12" cy="12" r="10" /><path d="M12 7v5l4 2" />
        </svg>
        <h2 className="cwp-empty-title">Nothing to continue yet</h2>
        <p className="cwp-empty-desc">
          Start playing a movie or an episode and it will show up here so you can pick
          up right where you left off.
        </p>
        <div className="cwp-empty-actions">
          <a href="/movies" className="btn btn-primary">Browse Movies</a>
          <a href="/series" className="btn btn-secondary">Browse Series</a>
        </div>
        <Styles />
      </div>
    );
  }

  return (
    <div className="cwp">
      <div className="cwp-controls">
        <div className="cwp-filters" role="group" aria-label="Filter by type">
          {([['all', 'All'], ['movie', 'Movies'], ['tv', 'Series']] as const).map(([key, text]) => (
            <button
              key={key}
              type="button"
              className={`cwp-chip ${filter === key ? 'cwp-chip--active' : ''}`}
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
            >
              {text} ({counts[key]})
            </button>
          ))}
        </div>

        <div className="cwp-tools">
          <input
            type="search"
            className="input cwp-search"
            placeholder="Search your history…"
            aria-label="Search continue watching"
            value={query}
            onChange={(ev) => setQuery(ev.target.value)}
          />
          <button type="button" className="cwp-clear" onClick={clearAll}>Clear all</button>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="cwp-no-match">No titles match that filter.</p>
      ) : (
        <div className="cwp-grid" role="list">
          {visible.map((e) => {
            const progress = pct(e);
            return (
              <article className="cwp-card" role="listitem" key={`${e.mediaType}-${e.id}`}>
                <a href={resumeHref(e)} className="cwp-link" aria-label={`Resume ${e.title}`}>
                  <div className="cwp-img-wrap">
                    {e.posterUrl ? (
                      <img src={e.posterUrl} alt="" className="cwp-img" loading="lazy" decoding="async" width="342" height="513" />
                    ) : (
                      <div className="cwp-placeholder" aria-hidden="true">{e.title}</div>
                    )}
                    <span className="cwp-play" aria-hidden="true">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                    </span>
                    {e.mediaType === 'tv' && e.season && e.episode && (
                      <span className="cwp-ep">S{e.season} · E{e.episode}</span>
                    )}
                    {progress !== null && (
                      <span className="cwp-bar" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={`${progress}% watched`}>
                        <span className="cwp-bar-fill" style={{ width: `${progress}%` }} />
                      </span>
                    )}
                  </div>
                </a>
                <div className="cwp-info">
                  <a href={resumeHref(e)} className="cwp-title">{e.title}</a>
                  <span className="cwp-meta">
                    {progress !== null ? `${progress}% watched` : e.mediaType === 'movie' ? 'Movie' : 'Series'}
                    {' · '}{relativeTime(e.updatedAt)}
                  </span>
                  <button type="button" className="cwp-remove" onClick={() => remove(e)} aria-label={`Remove ${e.title} from Continue Watching`}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
                    Remove
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <Styles />
    </div>
  );
}

function Styles() {
  return (
    <style>{`
      .cwp-controls {
        display: flex; align-items: center; justify-content: space-between;
        gap: 1rem; flex-wrap: wrap; margin-bottom: 2rem;
      }
      .cwp-filters { display: flex; gap: 0.25rem; flex-wrap: wrap; }
      .cwp-chip {
        padding: 0.4375rem 0.875rem;
        font: inherit; font-size: var(--font-size-sm); font-weight: 500;
        color: var(--color-text-2); background: none; cursor: pointer;
        border: 1px solid transparent; border-radius: var(--radius-full);
        transition: all var(--duration-fast) ease;
      }
      .cwp-chip:hover, .cwp-chip--active {
        color: var(--color-text); background: var(--color-surface-2);
        border-color: var(--color-border);
      }
      .cwp-tools { display: flex; align-items: center; gap: 0.5rem; }
      .cwp-search { width: auto; max-width: 220px; height: 38px; }
      .cwp-clear {
        font: inherit; font-size: var(--font-size-sm);
        color: var(--color-text-3); background: none; border: none;
        cursor: pointer; padding: 0.25rem 0.25rem;
        transition: color var(--duration-fast) ease;
      }
      .cwp-clear:hover { color: var(--color-error); }

      .cwp-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 1.25rem;
      }
      @media (min-width: 1024px) {
        .cwp-grid { grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); }
      }

      .cwp-skeleton {
        aspect-ratio: 2/3; border-radius: var(--radius-md);
        background: var(--color-surface-2); opacity: 0.6;
        animation: cwp-pulse 1.4s ease-in-out infinite;
      }
      @keyframes cwp-pulse { 0%,100% { opacity: 0.35; } 50% { opacity: 0.7; } }

      .cwp-card { display: flex; flex-direction: column; gap: 0.5rem; }
      .cwp-link { display: block; text-decoration: none; }
      .cwp-img-wrap {
        position: relative; aspect-ratio: 2/3; overflow: hidden;
        border-radius: var(--radius-md); background: var(--color-surface-2);
        transition: transform var(--duration-normal) ease, box-shadow var(--duration-normal) ease;
      }
      .cwp-card:hover .cwp-img-wrap { transform: translateY(-4px); box-shadow: 0 16px 40px rgba(0,0,0,0.5); }
      .cwp-img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .cwp-placeholder {
        width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
        padding: 1rem; text-align: center; font-size: 0.75rem; color: var(--color-text-3);
      }
      .cwp-play {
        position: absolute; inset: 0; margin: auto; width: 48px; height: 48px;
        display: flex; align-items: center; justify-content: center;
        border-radius: 50%; color: #fff; background: rgba(0,0,0,0.55);
        border: 1px solid rgba(255,255,255,0.3);
        backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
        opacity: 0; transform: scale(0.85); transition: all 0.2s ease;
      }
      .cwp-card:hover .cwp-play { opacity: 1; transform: scale(1); }
      .cwp-ep {
        position: absolute; top: 0.5rem; left: 0.5rem;
        font-size: 0.625rem; font-weight: 700; letter-spacing: 0.03em;
        color: #fff; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
        padding: 0.15rem 0.4rem; border-radius: var(--radius-full);
      }
      .cwp-bar {
        position: absolute; left: 0.5rem; right: 0.5rem; bottom: 0.5rem;
        height: 3px; border-radius: 999px; background: rgba(255,255,255,0.28);
        display: block; overflow: hidden;
      }
      .cwp-bar-fill { display: block; height: 100%; background: #e50914; border-radius: inherit; }

      .cwp-info { display: flex; flex-direction: column; gap: 0.2rem; }
      .cwp-title {
        font-size: var(--font-size-sm); font-weight: 500; color: var(--color-text);
        text-decoration: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .cwp-title:hover { text-decoration: underline; text-underline-offset: 2px; }
      .cwp-meta { font-size: var(--font-size-xs); color: var(--color-text-3); }
      .cwp-remove {
        align-self: flex-start;
        display: inline-flex; align-items: center; gap: 0.25rem;
        font: inherit; font-size: var(--font-size-xs); color: var(--color-text-3);
        background: none; border: none; padding: 0; cursor: pointer;
        transition: color var(--duration-fast) ease;
      }
      .cwp-remove:hover { color: var(--color-error); }

      .cwp-no-match { font-size: var(--font-size-sm); color: var(--color-text-2); padding: 2rem 0; }

      .cwp-empty {
        display: flex; flex-direction: column; align-items: center; gap: 0.75rem;
        padding: 5rem 0; text-align: center; color: var(--color-text-3);
      }
      .cwp-empty-icon { opacity: 0.5; }
      .cwp-empty-title { font-size: var(--font-size-xl); font-weight: 600; color: var(--color-text); margin: 0; }
      .cwp-empty-desc { font-size: var(--font-size-sm); color: var(--color-text-2); margin: 0; max-width: 420px; line-height: var(--line-height-normal); }
      .cwp-empty-actions { display: flex; gap: 0.75rem; flex-wrap: wrap; justify-content: center; margin-top: 0.5rem; }

      @media (max-width: 767px) {
        .cwp-controls { gap: 0.75rem; }
        .cwp-tools { width: 100%; }
        .cwp-search { flex: 1; max-width: none; }
      }
    `}</style>
  );
}
