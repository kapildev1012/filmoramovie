import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LiveItem, LiveSearchPayload, RecommendedPayload, SearchTab } from '../../lib/liveSearch';

const TMDB_IMG = 'https://image.tmdb.org/t/p';
const WL_KEY = 'filmora_watchlist';
const RECENT_KEY = 'filmora_recent_searches';
/** Typing feels instant below ~200ms; this also keeps TMDB calls reasonable. */
const DEBOUNCE_MS = 180;

interface DidYouMean {
  id: number;
  title: string;
  mediaType: 'movie' | 'tv';
  posterPath: string | null;
  year: string;
  href: string;
}

interface Props {
  initialQuery?: string;
  initialTab?: SearchTab;
  /** SSR-rendered results for `initialQuery` (avoids a refetch + flash on load). */
  initialData?: LiveSearchPayload | null;
  /** Trending picks shown while the field is empty. */
  recommended?: RecommendedPayload;
  popularQueries?: string[];
}

const EMPTY_PAYLOAD: LiveSearchPayload = {
  query: '',
  tab: 'all',
  movies: [],
  series: [],
  people: [],
  totals: { movies: 0, series: 0, people: 0 },
  didYouMean: [],
};

function itemHref(item: LiveItem) {
  if (item.mediaType === 'movie') return `/movie/${item.id}`;
  if (item.mediaType === 'tv') return `/series/${item.id}`;
  return `/search?q=${encodeURIComponent(item.title)}`;
}

function readRecent(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeRecent(list: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 8)));
  } catch {
    /* storage disabled — recents are a nicety, not a requirement */
  }
}

interface WatchlistEntry {
  id: number;
  mediaType: string;
  title: string;
  posterUrl: string | null;
  addedAt: string;
}

function readWatchlist(): WatchlistEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(WL_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export default function InstantSearch({
  initialQuery = '',
  initialTab = 'all',
  initialData = null,
  recommended = { movies: [], series: [] },
  popularQueries = [],
}: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [tab, setTab] = useState<SearchTab>(initialTab);
  const [data, setData] = useState<LiveSearchPayload>(initialData ?? EMPTY_PAYLOAD);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [saved, setSaved] = useState<Set<string>>(new Set());

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef(new Map<string, LiveSearchPayload>());
  const gridRef = useRef<HTMLDivElement>(null);

  const cacheKey = (q: string, t: SearchTab) => `${t}::${q.trim().toLocaleLowerCase()}`;

  // Seed the cache with what the server already rendered.
  const seeded = useRef(false);
  if (!seeded.current) {
    seeded.current = true;
    if (initialData && initialQuery.trim()) {
      cacheRef.current.set(cacheKey(initialQuery, initialTab), initialData);
    }
  }

  /* ── Watchlist hearts (shared localStorage with PosterCard) ───────────── */
  const syncSaved = useCallback(() => {
    setSaved(new Set(readWatchlist().map((i) => `${i.mediaType}-${i.id}`)));
  }, []);

  useEffect(() => {
    syncSaved();
    setRecent(readRecent());
  }, [syncSaved]);

  const toggleSaved = useCallback(
    (item: LiveItem) => {
      const list = readWatchlist();
      const idx = list.findIndex((i) => i.id === item.id && i.mediaType === item.mediaType);
      if (idx >= 0) list.splice(idx, 1);
      else
        list.push({
          id: item.id,
          mediaType: item.mediaType,
          title: item.title,
          posterUrl: item.posterPath ? `${TMDB_IMG}/w500${item.posterPath}` : null,
          addedAt: new Date().toISOString(),
        });
      try {
        localStorage.setItem(WL_KEY, JSON.stringify(list));
      } catch {
        /* ignore */
      }
      syncSaved();
    },
    [syncSaved]
  );

  /* ── Fetching ─────────────────────────────────────────────────────────── */
  const run = useCallback(async (q: string, t: SearchTab) => {
    const normalized = q.trim();
    if (!normalized) {
      abortRef.current?.abort();
      abortRef.current = null;
      setData(EMPTY_PAYLOAD);
      setLoading(false);
      return;
    }

    const key = cacheKey(normalized, t);
    const cached = cacheRef.current.get(key);
    if (cached) {
      setData(cached);
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/search-live?q=${encodeURIComponent(normalized)}&tab=${t}`,
        { signal: controller.signal }
      );
      const payload = (await res.json()) as LiveSearchPayload;
      if (controller.signal.aborted) return;
      if (!payload.error) cacheRef.current.set(key, payload);
      setData(payload);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setData({ ...EMPTY_PAYLOAD, query: normalized, tab: t, error: 'Search failed' });
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setLoading(false);
      }
    }
  }, []);

  // The core feature: one character is enough, no Enter, no button.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const normalized = query.trim();

    if (!normalized) {
      setData(EMPTY_PAYLOAD);
      setLoading(false);
      return;
    }
    // Already have it (SSR seed or previous keystroke) — paint immediately.
    const cached = cacheRef.current.get(cacheKey(normalized, tab));
    if (cached) {
      setData(cached);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => void run(normalized, tab), DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, tab, run]);

  // Keep the URL shareable without adding a history entry per keystroke.
  useEffect(() => {
    const normalized = query.trim();
    const params = new URLSearchParams();
    if (normalized) params.set('q', normalized);
    if (tab !== 'all') params.set('tab', tab);
    const next = params.toString() ? `/search?${params}` : '/search';
    if (window.location.pathname + window.location.search !== next) {
      window.history.replaceState({}, '', next);
    }
  }, [query, tab]);

  // Remember queries that actually returned something.
  const resultCount = data.movies.length + data.series.length + data.people.length;
  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2 || resultCount === 0) return;
    const t = setTimeout(() => {
      const list = readRecent().filter((x) => x.toLocaleLowerCase() !== normalized.toLocaleLowerCase());
      list.unshift(normalized);
      writeRecent(list);
      setRecent(list.slice(0, 8));
    }, 900);
    return () => clearTimeout(t);
  }, [query, resultCount]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const pick = useCallback((value: string) => {
    setQuery(value);
    setTab('all');
    inputRef.current?.focus();
  }, []);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      e.preventDefault();
      setQuery('');
      return;
    }
    if (e.key === 'Enter') {
      // No search button to press — Enter just jumps to the top hit.
      e.preventDefault();
      const first = data.movies[0] ?? data.series[0] ?? data.people[0];
      if (first) window.location.assign(itemHref(first));
      return;
    }
    if (e.key === 'ArrowDown') {
      const firstLink = gridRef.current?.querySelector<HTMLAnchorElement>('a[href]');
      if (firstLink) {
        e.preventDefault();
        firstLink.focus();
      }
    }
  }

  const tabs = useMemo(() => {
    const list: { id: SearchTab; label: string; count: number | null }[] = [
      { id: 'all', label: 'All', count: null },
      { id: 'movies', label: 'Movies', count: data.totals.movies },
      { id: 'series', label: 'Series', count: data.totals.series },
      { id: 'people', label: 'People', count: data.totals.people },
    ];
    // Hide empty buckets, but never hide the tab the user is currently on.
    return list.filter((t) => t.id === 'all' || t.id === tab || (t.count ?? 0) > 0);
  }, [data.totals, tab]);

  const typing = query.trim().length > 0;
  const showSkeleton = loading && resultCount === 0;
  const showMovies = (tab === 'all' || tab === 'movies') && data.movies.length > 0;
  const showSeries = (tab === 'all' || tab === 'series') && data.series.length > 0;
  const showPeople = (tab === 'all' || tab === 'people') && data.people.length > 0;
  const noResults = typing && !loading && resultCount === 0 && !data.error;

  return (
    <div className="is-root">
      {/* ── Search field ───────────────────────────────────────────────── */}
      <div className={`is-field ${loading ? 'is-field--busy' : ''}`} role="search">
        <svg className="is-field-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          className="is-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type a letter — we'll do the rest"
          aria-label="Search movies, series and people — results appear as you type"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus={!initialQuery}
        />
        {loading && <span className="is-spinner" role="status" aria-label="Searching" />}
        {typing && !loading && (
          <button type="button" className="is-clear" onClick={() => { setQuery(''); inputRef.current?.focus(); }} aria-label="Clear search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* ── Live region for assistive tech ─────────────────────────────── */}
      <p className="is-sr" role="status" aria-live="polite">
        {typing
          ? loading
            ? 'Searching…'
            : `${resultCount} result${resultCount === 1 ? '' : 's'} for ${query.trim()}`
          : ''}
      </p>

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      {typing && resultCount > 0 && (
        <div className="is-tabs" role="tablist" aria-label="Result categories">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`is-tab ${tab === t.id ? 'is-tab--active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {t.count != null && t.count > 0 && (
                <span className="is-tab-count">{t.count > 999 ? '999+' : t.count}</span>
              )}
            </button>
          ))}
        </div>
      )}

      <div ref={gridRef}>
        {/* ── Skeletons ─────────────────────────────────────────────────── */}
        {showSkeleton && (
          <div className="is-grid" aria-hidden="true">
            {Array.from({ length: 12 }).map((_, i) => (
              <div className="is-skel" key={i} />
            ))}
          </div>
        )}

        {/* ── Results ───────────────────────────────────────────────────── */}
        {showMovies && (
          <Section title="Movies" count={data.totals.movies} onSeeAll={tab === 'all' ? () => setTab('movies') : undefined}>
            <Grid items={data.movies} saved={saved} onToggleSave={toggleSaved} />
          </Section>
        )}
        {showSeries && (
          <Section title="Series" count={data.totals.series} onSeeAll={tab === 'all' ? () => setTab('series') : undefined}>
            <Grid items={data.series} saved={saved} onToggleSave={toggleSaved} />
          </Section>
        )}
        {showPeople && (
          <Section title="People" count={data.totals.people} onSeeAll={tab === 'all' ? () => setTab('people') : undefined}>
            <div className="is-people">
              {data.people.map((p) => (
                <a className="is-person" key={p.id} href={itemHref(p)}>
                  {p.posterPath ? (
                    <img className="is-person-img" src={`${TMDB_IMG}/w185${p.posterPath}`} alt="" loading="lazy" width={88} height={88} />
                  ) : (
                    <span className="is-person-img is-person-img--empty" aria-hidden="true">
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                    </span>
                  )}
                  <span className="is-person-name">{p.title}</span>
                  {p.department && <span className="is-person-dept">{p.department}</span>}
                </a>
              ))}
            </div>
          </Section>
        )}

        {/* ── Nothing matched ──────────────────────────────────────────── */}
        {noResults && (
          <div className="is-empty">
            <h2 className="is-empty-title">No matches for “{query.trim()}”</h2>
            <p className="is-empty-desc">Keep typing, or try one of these.</p>
            {data.didYouMean.length > 0 && (
              <>
                <p className="is-label">Did you mean</p>
                <div className="is-dym">
                  {(data.didYouMean as DidYouMean[]).map((s) => (
                    <a className="is-dym-card" key={`${s.mediaType}-${s.id}`} href={s.href}>
                      {s.posterPath ? (
                        <img src={`${TMDB_IMG}/w92${s.posterPath}`} alt="" width={40} height={60} loading="lazy" />
                      ) : (
                        <span className="is-dym-empty" aria-hidden="true" />
                      )}
                      <span className="is-dym-meta">
                        <span className="is-dym-title">{s.title}</span>
                        <span className="is-dym-sub">
                          {s.mediaType === 'movie' ? 'Movie' : 'Series'}
                          {s.year ? ` · ${s.year}` : ''}
                        </span>
                      </span>
                    </a>
                  ))}
                </div>
              </>
            )}
            <Chips label="Popular searches" items={popularQueries.slice(0, 6)} onPick={pick} />
          </div>
        )}

        {data.error && (
          <div className="is-empty">
            <h2 className="is-empty-title">Search is having a moment</h2>
            <p className="is-empty-desc">The catalogue did not answer. Try again in a second.</p>
            <button type="button" className="is-retry" onClick={() => void run(query, tab)}>Retry</button>
          </div>
        )}

        {/* ── Idle state: recommendations while the field is empty ─────── */}
        {!typing && (
          <div className="is-idle">
            {recent.length > 0 && (
              <div className="is-chips-block">
                <div className="is-chips-head">
                  <p className="is-label">Recent searches</p>
                  <button type="button" className="is-chips-clear" onClick={() => { writeRecent([]); setRecent([]); }}>
                    Clear
                  </button>
                </div>
                <div className="is-chips">
                  {recent.map((r) => (
                    <button type="button" key={r} className="is-chip" onClick={() => pick(r)}>{r}</button>
                  ))}
                </div>
              </div>
            )}

            <Chips label="Popular searches" items={popularQueries} onPick={pick} />

            {recommended.movies.length > 0 && (
              <Section title="Trending movies this week">
                <Grid items={recommended.movies} saved={saved} onToggleSave={toggleSaved} />
              </Section>
            )}
            {recommended.series.length > 0 && (
              <Section title="Trending series this week">
                <Grid items={recommended.series} saved={saved} onToggleSave={toggleSaved} />
              </Section>
            )}
          </div>
        )}
      </div>

      <style>{`
        .is-root { display: flex; flex-direction: column; }
        .is-sr {
          position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
          overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
        }

        /* Field */
        .is-field {
          position: relative;
          display: flex; align-items: center;
          max-width: 720px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-full, 999px);
          background: var(--color-surface);
          transition: border-color 180ms ease, box-shadow 180ms ease, background 180ms ease;
        }
        .is-field:focus-within {
          border-color: transparent;
          background: var(--color-surface-2, var(--color-surface));
          box-shadow: 0 0 0 1px var(--color-accent-from), 0 12px 40px rgba(161,66,244,0.18);
        }
        .is-field-icon { position: absolute; left: 0.875rem; color: var(--color-text-3); pointer-events: none; }
        .is-input {
          flex: 1; min-width: 0;
          height: 42px;
          padding: 0 2.75rem 0 2.75rem;
          background: none; border: 0; outline: none;
          color: var(--color-text);
          font-family: inherit; font-size: 0.9375rem;
        }
        .is-input::placeholder { color: var(--color-text-3); }
        .is-clear, .is-spinner { position: absolute; right: 0.875rem; }
        .is-clear {
          display: inline-flex; align-items: center; justify-content: center;
          width: 26px; height: 26px; border-radius: 50%;
          border: 0; cursor: pointer;
          background: var(--color-surface-2); color: var(--color-text-2);
        }
        .is-clear:hover { color: var(--color-text); }
        .is-spinner {
          width: 18px; height: 18px; border-radius: 50%;
          border: 2px solid var(--color-border);
          border-top-color: var(--color-accent-from);
          animation: is-spin 0.7s linear infinite;
        }
        @keyframes is-spin { to { transform: rotate(360deg); } }

        /* Tabs */
        .is-tabs {
          display: flex; gap: 0.375rem; margin: 0.875rem 0 1.125rem;
          overflow-x: auto; scrollbar-width: none;
        }
        .is-tabs::-webkit-scrollbar { display: none; }
        .is-tab {
          display: inline-flex; align-items: center; gap: 0.375rem;
          padding: 0.5rem 0.9rem; border-radius: var(--radius-full, 999px);
          border: 1px solid var(--color-border);
          background: transparent; color: var(--color-text-2);
          font-family: inherit; font-size: var(--font-size-sm, 0.875rem); font-weight: 500;
          cursor: pointer; white-space: nowrap;
          transition: color 160ms ease, border-color 160ms ease, background 160ms ease;
        }
        .is-tab:hover { color: var(--color-text); border-color: var(--color-text-3); }
        .is-tab--active {
          color: #fff; border-color: transparent;
          background: linear-gradient(135deg, var(--color-accent-from), var(--color-accent-to));
        }
        .is-tab-count { font-size: 0.7rem; opacity: 0.75; }

        /* Sections + grid */
        .is-section { margin-bottom: 2.5rem; }
        .is-section-head {
          display: flex; align-items: baseline; justify-content: space-between;
          gap: 1rem; margin-bottom: 1rem;
        }
        .is-section-title {
          margin: 0; font-size: var(--font-size-xl, 1.25rem); font-weight: 600;
          color: var(--color-text); letter-spacing: var(--letter-spacing-tight, -0.01em);
        }
        .is-section-more {
          border: 0; background: none; cursor: pointer; font-family: inherit;
          font-size: var(--font-size-sm, 0.875rem); color: var(--color-accent-from);
        }
        .is-section-more:hover { text-decoration: underline; }

        .is-grid {
          display: grid; gap: 1.25rem;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        }
        .is-skel {
          aspect-ratio: 2/3; border-radius: var(--radius-lg, 0.75rem);
          background: linear-gradient(100deg, var(--color-surface) 20%, var(--color-surface-2) 40%, var(--color-surface) 60%);
          background-size: 220% 100%;
          animation: is-shimmer 1.2s ease-in-out infinite;
        }
        @keyframes is-shimmer { to { background-position: -180% 0; } }

        /* Card */
        .is-card { position: relative; }
        .is-card-media {
          position: relative; display: block;
          aspect-ratio: 2/3; overflow: hidden;
          border-radius: var(--radius-lg, 0.75rem);
          background: var(--color-surface-2);
          box-shadow: 0 2px 10px rgba(0,0,0,0.3);
          transition: transform 240ms var(--ease-out-fast, ease), box-shadow 240ms ease;
        }
        .is-card:hover .is-card-media {
          transform: translateY(-6px);
          box-shadow: 0 20px 44px rgba(0,0,0,0.55), 0 0 28px rgba(161,66,244,0.26);
        }
        .is-card-media:focus-visible { outline: 2px solid var(--color-accent-from); outline-offset: 3px; }
        .is-card-img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .is-card-fallback {
          width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
          color: var(--color-text-3); font-size: var(--font-size-xs, 0.75rem); padding: 0.75rem; text-align: center;
        }
        .is-card-rating {
          position: absolute; top: 0.5rem; left: 0.5rem;
          display: inline-flex; align-items: center; gap: 0.25rem;
          font-size: 0.7rem; font-weight: 700; color: #fff;
          background: rgba(0,0,0,0.6); padding: 0.15rem 0.4rem;
          border-radius: var(--radius-sm, 0.25rem);
          backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
        }
        .is-card-type {
          position: absolute; top: 0.5rem; right: 0.5rem;
          font-size: 0.6rem; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase;
          color: #fff; background: rgba(0,0,0,0.6);
          border: 1px solid rgba(255,255,255,0.2);
          padding: 0.15rem 0.4rem; border-radius: var(--radius-sm, 0.25rem);
          backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
        }
        .is-card-fav {
          position: absolute; bottom: 0.5rem; right: 0.5rem;
          width: 34px; height: 34px; border-radius: 50%;
          display: inline-flex; align-items: center; justify-content: center;
          border: 1px solid rgba(255,255,255,0.25); background: rgba(0,0,0,0.45);
          color: #fff; cursor: pointer; opacity: 0; z-index: 2;
          backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
          transition: opacity 180ms ease, transform 160ms ease;
        }
        .is-card:hover .is-card-fav,
        .is-card:focus-within .is-card-fav,
        .is-card-fav--on { opacity: 1; }
        .is-card-fav:hover { transform: scale(1.1); }
        .is-card-fav--on { color: #ff4d6d; border-color: #ff4d6d; }
        .is-card-fav--on svg { fill: #ff4d6d; }
        .is-card-info { padding-top: 0.5rem; }
        .is-card-title {
          margin: 0; font-size: var(--font-size-sm, 0.875rem); font-weight: 500;
          color: var(--color-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .is-card-year { font-size: var(--font-size-xs, 0.75rem); color: var(--color-text-3); }

        /* People */
        .is-people { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); }
        .is-person {
          display: flex; flex-direction: column; align-items: center; gap: 0.375rem;
          text-align: center; text-decoration: none;
        }
        .is-person-img {
          width: 88px; height: 88px; border-radius: 50%; object-fit: cover; object-position: top center;
          border: 2px solid var(--color-border); background: var(--color-surface-2);
        }
        .is-person-img--empty { display: flex; align-items: center; justify-content: center; color: var(--color-text-3); }
        .is-person-name { font-size: var(--font-size-sm, 0.875rem); color: var(--color-text); }
        .is-person-dept { font-size: var(--font-size-xs, 0.75rem); color: var(--color-text-3); }

        /* Chips + empty states */
        .is-idle { display: flex; flex-direction: column; gap: 1.25rem; margin-top: 1rem; }
        .is-chips-block { display: flex; flex-direction: column; gap: 0.625rem; }
        .is-chips-head { display: flex; align-items: center; gap: 0.75rem; }
        .is-chips-clear {
          border: 0; background: none; cursor: pointer; font-family: inherit;
          font-size: var(--font-size-xs, 0.75rem); color: var(--color-text-3); text-decoration: underline;
        }
        .is-chips-clear:hover { color: var(--color-text); }
        .is-label {
          margin: 0; font-size: var(--font-size-xs, 0.75rem); font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-text-3);
        }
        .is-chips { display: flex; flex-wrap: wrap; gap: 0.5rem; }
        .is-chip {
          padding: 0.4rem 0.9rem; border-radius: var(--radius-full, 999px);
          border: 1px solid var(--color-border); background: transparent;
          color: var(--color-text-2); font-family: inherit; font-size: var(--font-size-sm, 0.875rem);
          cursor: pointer; transition: all 160ms ease;
        }
        .is-chip:hover { color: var(--color-text); border-color: var(--color-text-3); background: var(--color-surface-2); }

        .is-empty {
          display: flex; flex-direction: column; align-items: center; gap: 0.75rem;
          padding: 3rem 0; text-align: center;
        }
        .is-empty-title { margin: 0; font-size: var(--font-size-2xl, 1.5rem); font-weight: 600; color: var(--color-text); }
        .is-empty-desc { margin: 0; color: var(--color-text-2); }
        .is-retry {
          margin-top: 0.5rem; padding: 0.5rem 1.1rem; border-radius: var(--radius-full, 999px);
          border: 1px solid var(--color-border); background: transparent; color: var(--color-text);
          font-family: inherit; cursor: pointer;
        }
        .is-dym { display: flex; flex-wrap: wrap; gap: 0.625rem; justify-content: center; }
        .is-dym-card {
          display: flex; align-items: center; gap: 0.625rem; max-width: 15rem;
          padding: 0.375rem 0.75rem 0.375rem 0.375rem;
          border: 1px solid var(--color-border); border-radius: var(--radius-md, 0.5rem);
          background: var(--color-surface); text-decoration: none;
        }
        .is-dym-card:hover { border-color: var(--color-text-3); background: var(--color-surface-2); }
        .is-dym-card img, .is-dym-empty {
          width: 40px; height: 60px; object-fit: cover; border-radius: var(--radius-sm, 0.25rem);
          background: var(--color-surface-2); flex-shrink: 0;
        }
        .is-dym-meta { display: flex; flex-direction: column; min-width: 0; text-align: left; }
        .is-dym-title {
          font-size: var(--font-size-sm, 0.875rem); font-weight: 600; color: var(--color-text);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .is-dym-sub { font-size: var(--font-size-xs, 0.75rem); color: var(--color-text-3); }

        @media (max-width: 767px) {
          .is-field { max-width: 100%; }
          .is-input { height: 44px; font-size: 16px; }
          .is-grid { grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }
          .is-people { grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 0.75rem; }
          .is-person-img { width: 68px; height: 68px; }
          .is-section { margin-bottom: 2rem; }
          .is-card:hover .is-card-media { transform: none; box-shadow: 0 2px 10px rgba(0,0,0,0.3); }
          .is-card-fav { opacity: 1; width: 30px; height: 30px; }
        }
        @media (max-width: 380px) {
          .is-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (prefers-reduced-motion: reduce) {
          .is-card-media, .is-card:hover .is-card-media { transition: none; transform: none; }
          .is-skel { animation: none; }
          .is-spinner { animation-duration: 2s; }
        }
      `}</style>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────────── */

function Section({
  title,
  count,
  onSeeAll,
  children,
}: {
  title: string;
  count?: number;
  onSeeAll?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="is-section">
      <div className="is-section-head">
        <h2 className="is-section-title">{title}</h2>
        {onSeeAll && count != null && count > 0 && (
          <button type="button" className="is-section-more" onClick={onSeeAll}>
            See all {count.toLocaleString()} →
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function Grid({
  items,
  saved,
  onToggleSave,
}: {
  items: LiveItem[];
  saved: Set<string>;
  onToggleSave: (item: LiveItem) => void;
}) {
  return (
    <div className="is-grid">
      {items.map((item) => (
        <Card
          key={`${item.mediaType}-${item.id}`}
          item={item}
          isSaved={saved.has(`${item.mediaType}-${item.id}`)}
          onToggleSave={onToggleSave}
        />
      ))}
    </div>
  );
}

function Card({
  item,
  isSaved,
  onToggleSave,
}: {
  item: LiveItem;
  isSaved: boolean;
  onToggleSave: (item: LiveItem) => void;
}) {
  const href = itemHref(item);
  return (
    <article className="is-card">
      <a className="is-card-media" href={href} aria-label={`${item.title}${item.year ? ` (${item.year})` : ''}`}>
        {item.posterPath ? (
          <img
            className="is-card-img"
            src={`${TMDB_IMG}/w342${item.posterPath}`}
            alt=""
            loading="lazy"
            decoding="async"
            width={342}
            height={513}
          />
        ) : (
          <span className="is-card-fallback">{item.title}</span>
        )}
        {item.rating != null && <span className="is-card-rating">★ {item.rating.toFixed(1)}</span>}
        <span className="is-card-type">{item.mediaType === 'movie' ? 'Movie' : 'Series'}</span>
      </a>
      <button
        type="button"
        className={`is-card-fav ${isSaved ? 'is-card-fav--on' : ''}`}
        onClick={() => onToggleSave(item)}
        aria-pressed={isSaved}
        aria-label={`${isSaved ? 'Remove' : 'Add'} ${item.title} ${isSaved ? 'from' : 'to'} watchlist`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
        </svg>
      </button>
      <div className="is-card-info">
        <h3 className="is-card-title">{item.title}</h3>
        {item.year && <span className="is-card-year">{item.year}</span>}
      </div>
    </article>
  );
}

function Chips({
  label,
  items,
  onPick,
}: {
  label: string;
  items: string[];
  onPick: (value: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="is-chips-block">
      <p className="is-label">{label}</p>
      <div className="is-chips">
        {items.map((item) => (
          <button type="button" key={item} className="is-chip" onClick={() => onPick(item)}>
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}
