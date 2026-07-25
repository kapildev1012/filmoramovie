import { useState, useEffect, useRef, useCallback } from 'react';

interface SearchResult {
  id: number;
  title: string;
  mediaType: 'movie' | 'tv' | 'person';
  year: string;
  posterUrl: string | null;
  rating?: number;
}

interface TMDBItem {
  id: number;
  title?: string;
  name?: string;
  media_type: 'movie' | 'tv' | 'person';
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  profile_path?: string | null;
  vote_average?: number;
}

function toResult(item: TMDBItem): SearchResult {
  const title = item.title ?? item.name ?? 'Untitled';
  const year = (item.release_date ?? item.first_air_date ?? '').slice(0, 4);
  const imgPath = item.poster_path ?? item.profile_path ?? null;
  const posterUrl = imgPath ? `https://image.tmdb.org/t/p/w92${imgPath}` : null;
  return {
    id: item.id,
    title,
    mediaType: item.media_type,
    year,
    posterUrl,
    rating: item.vote_average ? Math.round(item.vote_average * 10) / 10 : undefined,
  };
}

interface Props {
  /** Placeholder shown before the user types */
  placeholder?: string;
  /** If true, auto-redirects to /search on submit */
  redirectOnSubmit?: boolean;
}

export default function SearchBar({
  placeholder = 'Search movies, series, people…',
  redirectOnSubmit = true,
}: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (!q.trim() || q.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json() as { results: TMDBItem[] };
      const mapped = (data.results ?? [])
        .filter((r) => r.media_type !== 'person' || r.name)
        .slice(0, 8)
        .map(toResult);
      setResults(mapped);
      setOpen(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setOpen(false);
    if (redirectOnSubmit) {
      window.location.href = `/search?q=${encodeURIComponent(query.trim())}`;
    }
  }

  function getHref(result: SearchResult) {
    if (result.mediaType === 'movie') return `/movie/${result.id}`;
    if (result.mediaType === 'tv') return `/series/${result.id}`;
    return `/search?q=${encodeURIComponent(result.title)}`;
  }

  function getTypeLabel(mediaType: string) {
    if (mediaType === 'movie') return 'Movie';
    if (mediaType === 'tv') return 'Series';
    return 'Person';
  }

  return (
    <div ref={containerRef} className="search-bar-container" role="search">
      <form onSubmit={handleSubmit} className="search-form" aria-label="Search Filmora">
        <div className="search-input-wrap">
          <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="search"
            className="input search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            aria-label="Search"
            aria-autocomplete="list"
            aria-controls={open ? 'search-dropdown' : undefined}
            aria-expanded={open}
            autoComplete="off"
            onFocus={() => results.length > 0 && setOpen(true)}
          />
          {loading && (
            <div className="search-spinner" aria-label="Searching…" role="status">
              <svg className="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
            </div>
          )}
        </div>
      </form>

      {/* Dropdown results */}
      {open && results.length > 0 && (
        <ul
          id="search-dropdown"
          className="search-dropdown"
          role="listbox"
          aria-label="Search results"
        >
          {results.map((result) => (
            <li key={`${result.mediaType}-${result.id}`} role="option">
              <a
                href={getHref(result)}
                className="search-result"
                onClick={() => setOpen(false)}
              >
                {result.posterUrl ? (
                  <img
                    src={result.posterUrl}
                    alt=""
                    className="search-result-poster"
                    loading="lazy"
                    width="32"
                    height="48"
                  />
                ) : (
                  <div className="search-result-poster search-result-poster--placeholder" aria-hidden="true">
                    {result.mediaType === 'person' ? '👤' : '🎬'}
                  </div>
                )}
                <div className="search-result-info">
                  <span className="search-result-title">{result.title}</span>
                  <span className="search-result-meta">
                    <span className="badge">{getTypeLabel(result.mediaType)}</span>
                    {result.year && <span className="search-result-year">{result.year}</span>}
                    {result.rating != null && result.rating > 0 && (
                      <span className="search-result-rating">★ {result.rating}</span>
                    )}
                  </span>
                </div>
              </a>
            </li>
          ))}
          <li className="search-see-all">
            <a href={`/search?q=${encodeURIComponent(query)}`} className="search-see-all-link">
              See all results for "{query}"
            </a>
          </li>
        </ul>
      )}

      <style>{`
        .search-bar-container {
          position: relative;
          width: 100%;
        }
        .search-form { width: 100%; }
        .search-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }
        .search-icon {
          position: absolute;
          left: 0.75rem;
          color: var(--color-text-3);
          pointer-events: none;
          flex-shrink: 0;
        }
        .search-input {
          padding-left: 2.5rem;
          padding-right: 2.5rem;
          height: 44px;
        }
        .search-spinner {
          position: absolute;
          right: 0.75rem;
          color: var(--color-text-3);
          display: flex;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.8s linear infinite; }
        .search-dropdown {
          position: absolute;
          top: calc(100% + 0.5rem);
          left: 0;
          right: 0;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          overflow: hidden;
          z-index: calc(var(--z-nav) + 1);
          box-shadow: 0 20px 60px rgba(0,0,0,0.5);
          list-style: none;
          margin: 0;
          padding: 0.5rem 0;
          max-height: 480px;
          overflow-y: auto;
        }
        .search-result {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.5rem 1rem;
          text-decoration: none;
          color: var(--color-text);
          transition: background 0.1s ease;
        }
        .search-result:hover {
          background: var(--color-surface-2);
        }
        .search-result-poster {
          width: 32px;
          height: 48px;
          object-fit: cover;
          border-radius: var(--radius-sm);
          flex-shrink: 0;
          background: var(--color-surface-2);
        }
        .search-result-poster--placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.25rem;
        }
        .search-result-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .search-result-title {
          font-size: 0.875rem;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .search-result-meta {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        .search-result-year,
        .search-result-rating {
          font-size: 0.75rem;
          color: var(--color-text-3);
        }
        .search-result-rating {
          color: var(--color-success);
        }
        .search-see-all {
          border-top: 1px solid var(--color-border);
          margin-top: 0.25rem;
          padding-top: 0.25rem;
        }
        .search-see-all-link {
          display: block;
          padding: 0.625rem 1rem;
          font-size: 0.8125rem;
          color: var(--color-accent-from);
          text-decoration: none;
          transition: background 0.1s ease;
        }
        .search-see-all-link:hover {
          background: var(--color-surface-2);
        }
      `}</style>
    </div>
  );
}
