// src/lib/liveSearch.ts — shared payload builder for instant (type-as-you-go) search.
//
// Both the SSR /search page and the /api/search-live endpoint use these helpers
// so the first paint and every keystroke render exactly the same shape.
import {
  searchMovies,
  searchSeries,
  searchPeople,
  rankByRelevance,
  getDidYouMeanSuggestions,
  getTrendingMovies,
  getTrendingSeries,
  type DidYouMeanSuggestion,
} from './tmdb';

export type LiveMediaType = 'movie' | 'tv' | 'person';

/** Trimmed result item — only what the grid actually renders. */
export interface LiveItem {
  id: number;
  title: string;
  mediaType: LiveMediaType;
  posterPath: string | null;
  backdropPath: string | null;
  year: string;
  rating: number | null;
  /** Only for people: "Acting", "Directing", … */
  department?: string;
}

export interface LiveSearchPayload {
  query: string;
  tab: SearchTab;
  movies: LiveItem[];
  series: LiveItem[];
  people: LiveItem[];
  totals: { movies: number; series: number; people: number };
  didYouMean: DidYouMeanSuggestion[];
  error?: string;
}

export type SearchTab = 'all' | 'movies' | 'series' | 'people';

export const SEARCH_TABS: SearchTab[] = ['all', 'movies', 'series', 'people'];

export function normalizeTab(value: string | null | undefined): SearchTab {
  return SEARCH_TABS.includes(value as SearchTab) ? (value as SearchTab) : 'all';
}

function round1(n: number | undefined): number | null {
  if (!n || n <= 0) return null;
  return Math.round(n * 10) / 10;
}

function mapMovie(m: any): LiveItem {
  return {
    id: m.id,
    title: m.title ?? m.original_title ?? 'Untitled',
    mediaType: 'movie',
    posterPath: m.poster_path ?? null,
    backdropPath: m.backdrop_path ?? null,
    year: (m.release_date ?? '').slice(0, 4),
    rating: round1(m.vote_average),
  };
}

function mapSeries(s: any): LiveItem {
  return {
    id: s.id,
    title: s.name ?? s.original_name ?? 'Untitled',
    mediaType: 'tv',
    posterPath: s.poster_path ?? null,
    backdropPath: s.backdrop_path ?? null,
    year: (s.first_air_date ?? '').slice(0, 4),
    rating: round1(s.vote_average),
  };
}

function mapPerson(p: any): LiveItem {
  return {
    id: p.id,
    title: p.name ?? 'Unknown',
    mediaType: 'person',
    posterPath: p.profile_path ?? null,
    backdropPath: null,
    year: '',
    rating: null,
    department: p.known_for_department ?? undefined,
  };
}

const EMPTY: Omit<LiveSearchPayload, 'query' | 'tab'> = {
  movies: [],
  series: [],
  people: [],
  totals: { movies: 0, series: 0, people: 0 },
  didYouMean: [],
};

/**
 * Search movies / series / people for `query` in parallel, re-ranked so the
 * exact title match wins (TMDB sorts by popularity, which buries it).
 *
 * A single character is enough — that is the whole point of instant search.
 */
export async function buildLiveSearch(
  rawQuery: string,
  rawTab: string | null = 'all',
  page = 1
): Promise<LiveSearchPayload> {
  const query = rawQuery.trim();
  const tab = normalizeTab(rawTab);
  if (!query) return { query: '', tab, ...EMPTY };

  const wantMovies = tab === 'all' || tab === 'movies';
  const wantSeries = tab === 'all' || tab === 'series';
  const wantPeople = tab === 'all' || tab === 'people';

  const [moviesRes, seriesRes, peopleRes] = await Promise.all([
    wantMovies ? searchMovies(query, page).catch(() => null) : null,
    wantSeries ? searchSeries(query, page).catch(() => null) : null,
    wantPeople ? searchPeople(query, page).catch(() => null) : null,
  ]);

  if (!moviesRes && !seriesRes && !peopleRes) {
    return { query, tab, ...EMPTY, error: 'Search failed' };
  }

  const movies = moviesRes ? rankByRelevance(query, moviesRes.results).map(mapMovie) : [];
  const series = seriesRes ? rankByRelevance(query, seriesRes.results).map(mapSeries) : [];
  const people = peopleRes
    ? rankByRelevance(query, peopleRes.results as any[])
        .filter((p: any) => p?.name)
        .map(mapPerson)
    : [];

  let didYouMean: DidYouMeanSuggestion[] = [];
  if (movies.length === 0 && series.length === 0 && people.length === 0) {
    didYouMean = await getDidYouMeanSuggestions(query).catch(() => []);
  }

  return {
    query,
    tab,
    movies,
    series,
    people,
    totals: {
      movies: moviesRes?.total_results ?? 0,
      series: seriesRes?.total_results ?? 0,
      people: peopleRes?.total_results ?? 0,
    },
    didYouMean,
  };
}

export interface RecommendedPayload {
  movies: LiveItem[];
  series: LiveItem[];
}

/** Trending picks shown while the field is still empty. */
export async function buildRecommended(limit = 12): Promise<RecommendedPayload> {
  const [movies, series] = await Promise.all([
    getTrendingMovies('week').catch(() => null),
    getTrendingSeries('week').catch(() => null),
  ]);
  return {
    movies: (movies?.results ?? []).slice(0, limit).map(mapMovie),
    series: (series?.results ?? []).slice(0, limit).map(mapSeries),
  };
}
