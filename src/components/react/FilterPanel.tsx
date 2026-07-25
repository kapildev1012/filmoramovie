import { useState, useEffect } from 'react';
import { FilterBadge } from '../ui/filter-badge';

interface Genre {
  id: number;
  name: string;
}

interface FilterValues {
  genres: number[];
  sortBy: string;
  yearFrom: string;
  yearTo: string;
  minRating: string;
  language: string;
}

interface Props {
  genres: Genre[];
  initialFilters?: Partial<FilterValues>;
  onFiltersChange?: (filters: FilterValues) => void;
  mediaType: 'movie' | 'tv';
}

const SORT_OPTIONS = [
  { value: 'popularity.desc', label: 'Most Popular' },
  { value: 'vote_average.desc', label: 'Highest Rated' },
  { value: 'release_date.desc', label: 'Newest First' },
  { value: 'release_date.asc', label: 'Oldest First' },
  { value: 'revenue.desc', label: 'Box Office' },
];

const LANGUAGE_OPTIONS = [
  { value: '', label: 'All Languages' },
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'ta', label: 'Tamil' },
  { value: 'te', label: 'Telugu' },
  { value: 'ml', label: 'Malayalam' },
  { value: 'ko', label: 'Korean' },
  { value: 'ja', label: 'Japanese' },
  { value: 'fr', label: 'French' },
  { value: 'es', label: 'Spanish' },
  { value: 'de', label: 'German' },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1899 }, (_, i) => CURRENT_YEAR - i);

export default function FilterPanel({
  genres,
  initialFilters = {},
  onFiltersChange,
  mediaType,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [filters, setFilters] = useState<FilterValues>({
    genres: initialFilters.genres ?? [],
    sortBy: initialFilters.sortBy ?? 'popularity.desc',
    yearFrom: initialFilters.yearFrom ?? '',
    yearTo: initialFilters.yearTo ?? '',
    minRating: initialFilters.minRating ?? '',
    language: initialFilters.language ?? '',
  });

  // Sync to URL query string + notify parent
  useEffect(() => {
    onFiltersChange?.(filters);
    const params = new URLSearchParams(window.location.search);

    if (filters.genres.length) {
      params.set('genres', filters.genres.join(','));
    } else {
      params.delete('genres');
    }
    if (filters.sortBy && filters.sortBy !== 'popularity.desc') {
      params.set('sort', filters.sortBy);
    } else {
      params.delete('sort');
    }
    if (filters.yearFrom) params.set('year_from', filters.yearFrom);
    else params.delete('year_from');
    if (filters.yearTo) params.set('year_to', filters.yearTo);
    else params.delete('year_to');
    if (filters.minRating) params.set('min_rating', filters.minRating);
    else params.delete('min_rating');
    if (filters.language) params.set('lang', filters.language);
    else params.delete('lang');

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }, [filters]);

  function toggleGenre(id: number) {
    setFilters((prev) => ({
      ...prev,
      genres: prev.genres.includes(id)
        ? prev.genres.filter((g) => g !== id)
        : [...prev.genres, id],
    }));
  }

  function resetFilters() {
    setFilters({
      genres: [],
      sortBy: 'popularity.desc',
      yearFrom: '',
      yearTo: '',
      minRating: '',
      language: '',
    });
  }

  const hasActiveFilters =
    filters.genres.length > 0 ||
    filters.sortBy !== 'popularity.desc' ||
    filters.yearFrom !== '' ||
    filters.yearTo !== '' ||
    filters.minRating !== '' ||
    filters.language !== '';

  // Lookups for rendering human-readable active-filter pills
  const genreName = (id: number) => genres.find((g) => g.id === id)?.name ?? `#${id}`;
  const sortLabel = SORT_OPTIONS.find((o) => o.value === filters.sortBy)?.label ?? filters.sortBy;
  const languageLabel = LANGUAGE_OPTIONS.find((l) => l.value === filters.language)?.label ?? filters.language;

  function clearFilter(key: keyof FilterValues) {
    setFilters((prev) => ({
      ...prev,
      [key]: key === 'sortBy' ? 'popularity.desc' : '',
    }));
  }

  return (
    <div className="filter-panel">
      {/* Sort + toggle row */}
      <div className="filter-top-row">
        <div className="filter-sort">
          <label htmlFor="sort-select" className="filter-label">Sort by</label>
          <select
            id="sort-select"
            className="input filter-select"
            value={filters.sortBy}
            onChange={(e) => setFilters((prev) => ({ ...prev, sortBy: e.target.value }))}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <button
          className={`btn btn-secondary filter-toggle ${expanded ? 'filter-toggle--active' : ''}`}
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-controls="filter-expanded"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="4" y1="6" x2="20" y2="6"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
            <line x1="11" y1="18" x2="13" y2="18"/>
          </svg>
          Filters
          {hasActiveFilters && (
            <span className="filter-badge" aria-label={`${filters.genres.length + (filters.minRating ? 1 : 0)} filters active`}>
              {filters.genres.length + (filters.minRating ? 1 : 0) + (filters.language ? 1 : 0)}
            </span>
          )}
        </button>

        {hasActiveFilters && (
          <button className="btn btn-ghost filter-reset" onClick={resetFilters}>
            Clear all
          </button>
        )}
      </div>

      {/* Active filter badges */}
      {hasActiveFilters && (
        <div className="active-filters" role="list" aria-label="Active filters">
          {filters.genres.map((id) => (
            <FilterBadge
              key={`genre-${id}`}
              variant="pill"
              label="Genre"
              value={genreName(id)}
              onRemove={() => toggleGenre(id)}
            />
          ))}
          {filters.sortBy !== 'popularity.desc' && (
            <FilterBadge
              variant="pill"
              label="Sort"
              value={sortLabel}
              onRemove={() => clearFilter('sortBy')}
            />
          )}
          {filters.yearFrom && (
            <FilterBadge
              variant="pill"
              label="From"
              value={filters.yearFrom}
              onRemove={() => clearFilter('yearFrom')}
            />
          )}
          {filters.yearTo && (
            <FilterBadge
              variant="pill"
              label="To"
              value={filters.yearTo}
              onRemove={() => clearFilter('yearTo')}
            />
          )}
          {filters.minRating && (
            <FilterBadge
              variant="pill"
              label="Rating"
              value={`★ ${filters.minRating}+`}
              onRemove={() => clearFilter('minRating')}
            />
          )}
          {filters.language && (
            <FilterBadge
              variant="pill"
              label="Language"
              value={languageLabel}
              onRemove={() => clearFilter('language')}
            />
          )}
        </div>
      )}

      {/* Expanded filters */}
      {expanded && (
        <div id="filter-expanded" className="filter-expanded">
          {/* Genres */}
          <div className="filter-section">
            <h3 className="filter-section-title">Genres</h3>
            <div className="genre-chips">
              {genres.map((genre) => (
                <button
                  key={genre.id}
                  className={`genre-chip ${filters.genres.includes(genre.id) ? 'genre-chip--active' : ''}`}
                  onClick={() => toggleGenre(genre.id)}
                  aria-pressed={filters.genres.includes(genre.id)}
                >
                  {genre.name}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-row">
            {/* Release year */}
            <div className="filter-section">
              <h3 className="filter-section-title">Release Year</h3>
              <div className="year-range">
                <select
                  className="input filter-select-sm"
                  value={filters.yearFrom}
                  onChange={(e) => setFilters((prev) => ({ ...prev, yearFrom: e.target.value }))}
                  aria-label="From year"
                >
                  <option value="">From</option>
                  {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
                <span className="year-separator">–</span>
                <select
                  className="input filter-select-sm"
                  value={filters.yearTo}
                  onChange={(e) => setFilters((prev) => ({ ...prev, yearTo: e.target.value }))}
                  aria-label="To year"
                >
                  <option value="">To</option>
                  {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            {/* Min rating */}
            <div className="filter-section">
              <h3 className="filter-section-title">Min Rating</h3>
              <div className="rating-buttons">
                {['6', '7', '7.5', '8', '8.5'].map((r) => (
                  <button
                    key={r}
                    className={`rating-btn ${filters.minRating === r ? 'rating-btn--active' : ''}`}
                    onClick={() => setFilters((prev) => ({
                      ...prev,
                      minRating: prev.minRating === r ? '' : r,
                    }))}
                    aria-pressed={filters.minRating === r}
                  >
                    ★ {r}+
                  </button>
                ))}
              </div>
            </div>

            {/* Language */}
            <div className="filter-section">
              <h3 className="filter-section-title">Language</h3>
              <select
                className="input filter-select"
                value={filters.language}
                onChange={(e) => setFilters((prev) => ({ ...prev, language: e.target.value }))}
                aria-label="Original language"
              >
                {LANGUAGE_OPTIONS.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .filter-panel {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-bottom: 2rem;
        }
        .filter-top-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
        }
        .filter-label {
          font-size: 0.75rem;
          color: var(--color-text-3);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-weight: 600;
          display: block;
          margin-bottom: 0.25rem;
        }
        .filter-sort {
          flex: 1;
          min-width: 180px;
          max-width: 240px;
        }
        .filter-select {
          width: 100%;
          appearance: none;
          cursor: pointer;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 0.75rem center;
          padding-right: 2rem;
        }
        .filter-toggle {
          position: relative;
          flex-shrink: 0;
        }
        .filter-toggle--active {
          border-color: var(--color-accent-from);
          color: var(--color-text);
        }
        .filter-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--color-accent-from), var(--color-accent-to));
          color: #fff;
          font-size: 0.6875rem;
          font-weight: 700;
        }
        .filter-reset {
          font-size: 0.8125rem;
          padding: 0.5rem 0.75rem;
          color: var(--color-text-3);
        }
        .active-filters {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        .filter-expanded {
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 1.25rem;
          background: var(--color-surface);
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .filter-row {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 1.5rem;
        }
        .filter-section-title {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--color-text-2);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin: 0 0 0.75rem;
        }
        .genre-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        .genre-chip {
          padding: 0.3125rem 0.75rem;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-full);
          font-size: 0.8125rem;
          color: var(--color-text-2);
          background: transparent;
          cursor: pointer;
          transition: all 0.15s ease;
          font-family: inherit;
        }
        .genre-chip:hover {
          border-color: var(--color-text-3);
          color: var(--color-text);
        }
        .genre-chip--active {
          background: linear-gradient(135deg, var(--color-accent-from), var(--color-accent-to));
          border-color: transparent;
          color: #fff;
        }
        .year-range {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .filter-select-sm {
          flex: 1;
          width: auto;
          appearance: none;
          cursor: pointer;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 0.5rem center;
          padding-right: 1.5rem;
          min-width: 0;
        }
        .year-separator {
          color: var(--color-text-3);
          font-size: 0.875rem;
          flex-shrink: 0;
        }
        .rating-buttons {
          display: flex;
          gap: 0.375rem;
          flex-wrap: wrap;
        }
        .rating-btn {
          padding: 0.3125rem 0.625rem;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          font-size: 0.75rem;
          color: var(--color-text-2);
          background: transparent;
          cursor: pointer;
          transition: all 0.15s ease;
          font-family: inherit;
        }
        .rating-btn:hover {
          color: var(--color-success);
          border-color: var(--color-success);
        }
        .rating-btn--active {
          background: var(--color-success);
          border-color: var(--color-success);
          color: #000;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}
