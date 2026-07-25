// ─── TMDB Core Types ──────────────────────────────────────────────────────────

export interface TMDBImage {
  file_path: string;
  width: number;
  height: number;
  aspect_ratio: number;
  vote_average: number;
  vote_count: number;
  iso_639_1: string | null;
}

export interface TMDBGenre {
  id: number;
  name: string;
}

export interface TMDBProductionCompany {
  id: number;
  name: string;
  logo_path: string | null;
  origin_country: string;
}

export interface TMDBProductionCountry {
  iso_3166_1: string;
  name: string;
}

export interface TMDBSpokenLanguage {
  iso_639_1: string;
  english_name: string;
  name: string;
}

// ─── Movie Types ──────────────────────────────────────────────────────────────

export interface TMDBMovieBase {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  genre_ids: number[];
  vote_average: number;
  vote_count: number;
  popularity: number;
  adult: boolean;
  original_language: string;
  video: boolean;
  media_type?: 'movie';
}

export interface TMDBMovie extends TMDBMovieBase {
  genres: TMDBGenre[];
  runtime: number | null;
  tagline: string;
  status: string;
  budget: number;
  revenue: number;
  homepage: string | null;
  imdb_id: string | null;
  production_companies: TMDBProductionCompany[];
  production_countries: TMDBProductionCountry[];
  spoken_languages: TMDBSpokenLanguage[];
  belongs_to_collection: {
    id: number;
    name: string;
    poster_path: string | null;
    backdrop_path: string | null;
  } | null;
}

// ─── TV / Series Types ────────────────────────────────────────────────────────

export interface TMDBSeriesBase {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  genre_ids: number[];
  vote_average: number;
  vote_count: number;
  popularity: number;
  adult: boolean;
  original_language: string;
  origin_country: string[];
  media_type?: 'tv';
}

export interface TMDBEpisode {
  id: number;
  name: string;
  overview: string;
  episode_number: number;
  season_number: number;
  air_date: string;
  runtime: number | null;
  still_path: string | null;
  vote_average: number;
  vote_count: number;
}

export interface TMDBSeason {
  id: number;
  name: string;
  overview: string;
  season_number: number;
  episode_count: number;
  air_date: string;
  poster_path: string | null;
  episodes?: TMDBEpisode[];
}

export interface TMDBSeries extends TMDBSeriesBase {
  genres: TMDBGenre[];
  number_of_seasons: number;
  number_of_episodes: number;
  status: string;
  tagline: string;
  homepage: string | null;
  type: string;
  seasons: TMDBSeason[];
  production_companies: TMDBProductionCompany[];
  spoken_languages: TMDBSpokenLanguage[];
  networks: { id: number; name: string; logo_path: string | null }[];
  created_by: { id: number; name: string; profile_path: string | null }[];
  last_air_date: string;
  in_production: boolean;
  episode_run_time: number[];
}

// ─── People Types ─────────────────────────────────────────────────────────────

export interface TMDBPersonBase {
  id: number;
  name: string;
  profile_path: string | null;
  popularity: number;
  media_type?: 'person';
  known_for_department?: string;
}

export interface TMDBCastMember extends TMDBPersonBase {
  character: string;
  order: number;
  credit_id: string;
  cast_id: number;
}

export interface TMDBCrewMember extends TMDBPersonBase {
  department: string;
  job: string;
  credit_id: string;
}

export interface TMDBCredits {
  id: number;
  cast: TMDBCastMember[];
  crew: TMDBCrewMember[];
}

// ─── Video Types ──────────────────────────────────────────────────────────────

export interface TMDBVideo {
  id: string;
  key: string;
  name: string;
  site: string;
  size: number;
  type: string;
  official: boolean;
  published_at: string;
  iso_639_1: string;
  iso_3166_1: string;
}

export interface TMDBVideosResponse {
  id: number;
  results: TMDBVideo[];
}

// ─── Watch Provider Types ─────────────────────────────────────────────────────

export interface TMDBProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
  display_priority: number;
}

export interface TMDBWatchProvidersByCountry {
  link: string;
  flatrate?: TMDBProvider[];
  rent?: TMDBProvider[];
  buy?: TMDBProvider[];
  ads?: TMDBProvider[];
  free?: TMDBProvider[];
}

export interface TMDBWatchProvidersResponse {
  id: number;
  results: Record<string, TMDBWatchProvidersByCountry>;
}

// ─── Paginated Response ───────────────────────────────────────────────────────

export interface TMDBPaginatedResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

// ─── Trending / Multi ─────────────────────────────────────────────────────────

export type TMDBTrendingItem = (TMDBMovieBase | TMDBSeriesBase | TMDBPersonBase) & {
  media_type: 'movie' | 'tv' | 'person';
};

export function isMovie(item: TMDBTrendingItem): item is TMDBMovieBase & { media_type: 'movie' } {
  return item.media_type === 'movie';
}

export function isSeries(item: TMDBTrendingItem): item is TMDBSeriesBase & { media_type: 'tv' } {
  return item.media_type === 'tv';
}

export function isPerson(item: TMDBTrendingItem): item is TMDBPersonBase & { media_type: 'person' } {
  return item.media_type === 'person';
}

// ─── Genre List ───────────────────────────────────────────────────────────────

export interface TMDBGenreList {
  genres: TMDBGenre[];
}

// ─── Discover Params ─────────────────────────────────────────────────────────

export interface DiscoverMovieParams {
  page?: number;
  sort_by?: string;
  with_genres?: string;
  'primary_release_date.gte'?: string;
  'primary_release_date.lte'?: string;
  'vote_average.gte'?: number;
  'vote_count.gte'?: number;
  with_original_language?: string;
  'with_runtime.gte'?: number;
  'with_runtime.lte'?: number;
  year?: number;
}

export interface DiscoverSeriesParams {
  page?: number;
  sort_by?: string;
  with_genres?: string;
  'first_air_date.gte'?: string;
  'first_air_date.lte'?: string;
  'vote_average.gte'?: number;
  with_original_language?: string;
}

// ─── App-level Types (DB) ────────────────────────────────────────────────────

export interface User {
  id: string;
  google_id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  name: string;
  avatar_color: string;
  is_kids: boolean;
  is_default: boolean;
  created_at: string;
}

export interface WatchlistEntry {
  id: string;
  profile_id: string;
  tmdb_id: number;
  media_type: 'movie' | 'tv';
  title: string;
  poster_path: string | null;
  added_at: string;
}

export interface Rating {
  id: string;
  profile_id: string;
  tmdb_id: number;
  media_type: 'movie' | 'tv';
  rating: number; // 1-5
  created_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  expires_at: Date;
}
