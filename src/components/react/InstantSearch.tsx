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
      {/* Wrapper is a no-op on desktop; on a phone it becomes a sticky, full-
          bleed bar so the field stays reachable while the results scroll. */}
      <div className="is-searchbar">
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
        <button type="button" className="is-search-btn" onClick={() => inputRef.current?.focus()}>Search</button>
      </div>
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
        .is-searchbar { position: relative; }
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
          padding: 0 5.75rem 0 2.75rem;
          background: none; border: 0; outline: none;
          color: var(--color-text);
          font-family: inherit; font-size: 0.9375rem;
        }
        .is-input::placeholder { color: var(--color-text-3); }
        .is-clear, .is-spinner { position: absolute; right: 4.5rem; }
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

        .is-search-btn {
          position: absolute; right: 0.375rem;
          background: linear-gradient(135deg, var(--color-accent-from), var(--color-accent-to));
          color: #fff; border: 0; padding: 0.35rem 0.85rem; border-radius: 999px;
          font-size: 0.75rem; font-weight: 700; text-transform: uppercase; cursor: pointer;
          transition: opacity 150ms ease, transform 150ms ease;
        }
        .is-search-btn:hover { opacity: 0.9; transform: scale(1.05); }
        .is-search-btn:active { transform: scale(0.95); }

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

        /* Grid — same tracks and rhythm as the /series and /movies browse grids
           so a search result is visually indistinguishable from a browse card. */
        .is-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          column-gap: 1.5rem;
          row-gap: 2rem;
        }
        @media (min-width: 640px) {
          .is-grid {
            grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
            column-gap: 1.75rem;
            row-gap: 2.25rem;
          }
        }
        @media (min-width: 1024px) {
          .is-grid {
            grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
            column-gap: 2rem;
            row-gap: 2.5rem;
          }
        }
        .is-skel {
          aspect-ratio: 7/12; border-radius: var(--radius-lg, 0.75rem);
          background: linear-gradient(100deg, var(--color-surface) 20%, var(--color-surface-2) 40%, var(--color-surface) 60%);
          background-size: 220% 100%;
          animation: is-shimmer 1.2s ease-in-out infinite;
        }
        @keyframes is-shimmer { to { background-position: -180% 0; } }

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
        .is-chips { display: flex; flex-wrap: nowrap; gap: 0.5rem; overflow-x: auto; scrollbar-width: none; padding-bottom: 0.25rem; -webkit-overflow-scrolling: touch; }
        .is-chips::-webkit-scrollbar { display: none; }
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
          /* Sticky, full-bleed search bar: it stays put just under the floating
             nav pill while the results scroll, so re-typing or clearing never
             means scrolling back to the top of the page. */
          .is-searchbar {
            position: sticky;
            top: calc(var(--mob-nav-h, 60px) - 4px);
            z-index: 20;
            margin: 0 calc(-1 * var(--mob-pad-x, 1rem));
            padding: 0.5rem var(--mob-pad-x, 1rem) 0.625rem;
            background: var(--color-bg, #000);
          }
          .is-searchbar::after {
            content: '';
            position: absolute; left: 0; right: 0; bottom: 0; height: 1px;
            background: var(--color-border); opacity: 0.7;
          }
          .is-field { max-width: 100%; }
          /* The "Search" button is redundant on touch — typing is already
             instant and tapping the field focuses it — so hide it and reclaim
             the row. The input then only reserves room for the clear (×) /
             spinner, which move flush to the right edge. */
          .is-search-btn { display: none; }
          .is-input { height: 46px; font-size: 16px; padding-right: 2.75rem; }
          .is-clear, .is-spinner { right: 0.75rem; }

          /* Tabs: momentum scroll and roomier 40px targets; a small edge inset so
             the first and last pill are not flush against the screen edge. */
          .is-tabs {
            margin: 0.75rem 0 1rem;
            padding-bottom: 0.125rem;
            -webkit-overflow-scrolling: touch;
            scroll-padding-inline: 0.25rem;
          }
          .is-tab { padding: 0.55rem 0.95rem; }

          /* Phones: a fixed 3-up grid (2-up on the narrowest devices), matching
             the /series and /movies browse grids. */
          .is-grid {
            grid-template-columns: repeat(3, 1fr);
            column-gap: 0.75rem;
            row-gap: 1.5rem;
          }
          .is-people { grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 0.75rem; }
          .is-person-img { width: 68px; height: 68px; }
          .is-section { margin-bottom: 2rem; }
          .is-section-head { margin-bottom: 0.75rem; }

          /* Chips are the primary navigation on the idle screen — thumb-sized. */
          .is-chip { padding: 0.55rem 1rem; }
        }
        @media (max-width: 380px) {
          .is-grid { grid-template-columns: repeat(2, 1fr); column-gap: 0.75rem; }
        }
        @media (prefers-reduced-motion: reduce) {
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
    <div className="is-grid poster-grid" role="list">
      {items.map((item) => (
        <div role="listitem" key={`${item.mediaType}-${item.id}`}>
          <Card
            item={item}
            isSaved={saved.has(`${item.mediaType}-${item.id}`)}
            onToggleSave={onToggleSave}
          />
        </div>
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
  const label = `${item.title}${item.year ? ` (${item.year})` : ''}`;
  // Same premium markup as PosterCard.astro (styles: src/styles/poster-card.css).
  const quality = item.rating != null && item.rating >= 8 ? '4K' : 'HD';
  return (
    <article className="poster-card">
      <div className="poster-card-img-wrap">
        {/* Stretched cover link (whole card is clickable) */}
        <a href={href} className="poster-card-cover" aria-label={label} />

        {item.posterPath ? (
          <img
            src={`${TMDB_IMG}/w500${item.posterPath}`}
            alt=""
            className="poster-card-img"
            loading="lazy"
            decoding="async"
            width={500}
            height={857}
          />
        ) : (
          <div className="poster-card-placeholder" aria-hidden="true">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
            <span className="poster-card-placeholder-text">{item.title}</span>
          </div>
        )}

        {/* Hover overlay with actions */}
        <div className="poster-card-overlay">
          <div className="poster-card-meta">
            {item.year && <span className="pc-year">{item.year}</span>}
            <span className={`pc-type ${item.mediaType === 'movie' ? 'pc-type--movie' : 'pc-type--tv'}`}>
              {item.mediaType === 'movie' ? 'Movie' : 'Series'}
            </span>
          </div>
          <div className="poster-card-actions">
            <a href={href} className="pc-btn pc-btn--play" aria-label={`Play ${item.title}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
            </a>
            <button
              type="button"
              className={`pc-btn pc-fav-live ${isSaved ? 'pc-fav-live--on' : ''}`}
              onClick={() => onToggleSave(item)}
              aria-pressed={isSaved}
              aria-label={`${isSaved ? 'Remove' : 'Add'} ${item.title} ${isSaved ? 'from' : 'to'} watchlist`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
              </svg>
            </button>
            <a href={href} className="pc-btn pc-btn--info" aria-label={`Details for ${item.title}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
            </a>
          </div>
        </div>
      </div>

      {/* Badges sit OUTSIDE the scaling wrap — they stay fixed during hover */}
      <div className="poster-card-badges" aria-hidden="true">
        {item.rating != null && item.rating > 0 && (
          <span className="pc-imdb"><span className="pc-imdb-tag">IMDb</span>{item.rating.toFixed(1)}</span>
        )}
        <span className="pc-quality">{quality}</span>
      </div>

      <div className="poster-card-info">
        <h3 className="poster-card-title">{item.title}</h3>
        {item.year && <span className="poster-card-subtitle">{item.year}</span>}
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
