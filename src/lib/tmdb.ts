/**
 * TMDB API Client
 * Covers all endpoints needed for Filmora Movie.
 * API key must be set in TMDB_API_KEY environment variable.
 *
 * TMDB API docs: https://developer.themoviedb.org/docs
 */

import type {
  TMDBMovie,
  TMDBMovieBase,
  TMDBSeries,
  TMDBSeriesBase,
  TMDBSeason,
  TMDBCredits,
  TMDBVideosResponse,
  TMDBWatchProvidersResponse,
  TMDBPaginatedResponse,
  TMDBTrendingItem,
  TMDBGenreList,
  TMDBPersonBase,
  DiscoverMovieParams,
  DiscoverSeriesParams,
} from './types';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

/** Get the full API key from env. Throws if missing. */
function getApiKey(): string {
  const key = import.meta.env.TMDB_API_KEY;
  if (!key) {
    throw new Error('TMDB_API_KEY environment variable is not set.');
  }
  return key as string;
}

/** Build a TMDB image URL. Returns null if path is null. */
export function tmdbImage(
  path: string | null | undefined,
  size: 'w92' | 'w154' | 'w185' | 'w342' | 'w500' | 'w780' | 'original' = 'w500'
): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

/** Internal fetch helper with error handling and caching headers */
async function tmdbFetch<T>(
  endpoint: string,
  params: Record<string, string | number | boolean | undefined> = {},
  ttlSeconds = 3600
): Promise<T> {
  const apiKey = getApiKey();
  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('language', 'en-US');

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  const res = await fetch(url.toString(), {
    headers: { 'Content-Type': 'application/json' },
    // Astro's cache hint for static pre-rendered pages
    // @ts-ignore — Astro extends RequestInit with these
    next: { revalidate: ttlSeconds },
  });

  if (!res.ok) {
    throw new Error(`TMDB API error ${res.status}: ${res.statusText} — ${endpoint}`);
  }

  return res.json() as Promise<T>;
}

// ─── Trending ────────────────────────────────────────────────────────────────

/** GET /trending/all/week — mixed trending for hero carousel */
export async function getTrending(
  timeWindow: 'day' | 'week' = 'week'
): Promise<TMDBPaginatedResponse<TMDBTrendingItem>> {
  return tmdbFetch(`/trending/all/${timeWindow}`);
}

/** GET /trending/movie/week */
export async function getTrendingMovies(
  timeWindow: 'day' | 'week' = 'week'
): Promise<TMDBPaginatedResponse<TMDBMovieBase>> {
  return tmdbFetch(`/trending/movie/${timeWindow}`);
}

/** GET /trending/tv/week */
export async function getTrendingSeries(
  timeWindow: 'day' | 'week' = 'week'
): Promise<TMDBPaginatedResponse<TMDBSeriesBase>> {
  return tmdbFetch(`/trending/tv/${timeWindow}`);
}

// ─── Movies ───────────────────────────────────────────────────────────────────

/** GET /movie/{id} — full movie details */
export async function getMovie(id: number | string): Promise<TMDBMovie> {
  return tmdbFetch(`/movie/${id}`);
}

/** GET /movie/{id}/credits */
export async function getMovieCredits(id: number | string): Promise<TMDBCredits> {
  return tmdbFetch(`/movie/${id}/credits`);
}

/** GET /movie/{id}/videos */
export async function getMovieVideos(id: number | string): Promise<TMDBVideosResponse> {
  return tmdbFetch(`/movie/${id}/videos`);
}

/** GET /movie/{id}/watch/providers */
export async function getMovieWatchProviders(
  id: number | string
): Promise<TMDBWatchProvidersResponse> {
  return tmdbFetch(`/movie/${id}/watch/providers`);
}

/** GET /movie/{id}/recommendations */
export async function getMovieRecommendations(
  id: number | string,
  page = 1
): Promise<TMDBPaginatedResponse<TMDBMovieBase>> {
  return tmdbFetch(`/movie/${id}/recommendations`, { page });
}

/** GET /movie/top_rated */
export async function getTopRatedMovies(
  page = 1
): Promise<TMDBPaginatedResponse<TMDBMovieBase>> {
  return tmdbFetch('/movie/top_rated', { page });
}

/** GET /movie/now_playing */
export async function getNowPlayingMovies(
  page = 1
): Promise<TMDBPaginatedResponse<TMDBMovieBase>> {
  return tmdbFetch('/movie/now_playing', { page });
}

/** GET /movie/upcoming */
export async function getUpcomingMovies(
  page = 1
): Promise<TMDBPaginatedResponse<TMDBMovieBase>> {
  return tmdbFetch('/movie/upcoming', { page });
}

/** GET /movie/popular */
export async function getPopularMovies(
  page = 1
): Promise<TMDBPaginatedResponse<TMDBMovieBase>> {
  return tmdbFetch('/movie/popular', { page });
}

// ─── TV / Series ──────────────────────────────────────────────────────────────

/** GET /tv/{id} — full series details */
export async function getSeries(id: number | string): Promise<TMDBSeries> {
  return tmdbFetch(`/tv/${id}`);
}

/** GET /tv/{id}/season/{season_number} */
export async function getSeasonDetails(
  seriesId: number | string,
  seasonNumber: number
): Promise<TMDBSeason> {
  return tmdbFetch(`/tv/${seriesId}/season/${seasonNumber}`);
}

/** GET /tv/{id}/credits */
export async function getSeriesCredits(id: number | string): Promise<TMDBCredits> {
  return tmdbFetch(`/tv/${id}/credits`);
}

/** GET /tv/{id}/videos */
export async function getSeriesVideos(id: number | string): Promise<TMDBVideosResponse> {
  return tmdbFetch(`/tv/${id}/videos`);
}

/** GET /tv/{id}/watch/providers */
export async function getSeriesWatchProviders(
  id: number | string
): Promise<TMDBWatchProvidersResponse> {
  return tmdbFetch(`/tv/${id}/watch/providers`);
}

/** GET /tv/{id}/recommendations */
export async function getSeriesRecommendations(
  id: number | string,
  page = 1
): Promise<TMDBPaginatedResponse<TMDBSeriesBase>> {
  return tmdbFetch(`/tv/${id}/recommendations`, { page });
}

/** GET /tv/top_rated */
export async function getTopRatedSeries(
  page = 1
): Promise<TMDBPaginatedResponse<TMDBSeriesBase>> {
  return tmdbFetch('/tv/top_rated', { page });
}

/** GET /tv/popular */
export async function getPopularSeries(
  page = 1
): Promise<TMDBPaginatedResponse<TMDBSeriesBase>> {
  return tmdbFetch('/tv/popular', { page });
}

/** GET /tv/on_the_air */
export async function getOnAirSeries(
  page = 1
): Promise<TMDBPaginatedResponse<TMDBSeriesBase>> {
  return tmdbFetch('/tv/on_the_air', { page });
}

// ─── Discover ─────────────────────────────────────────────────────────────────

/** GET /discover/movie */
export async function discoverMovies(
  params: DiscoverMovieParams = {}
): Promise<TMDBPaginatedResponse<TMDBMovieBase>> {
  return tmdbFetch('/discover/movie', params as Record<string, string | number | boolean>);
}

/** GET /discover/tv */
export async function discoverSeries(
  params: DiscoverSeriesParams = {}
): Promise<TMDBPaginatedResponse<TMDBSeriesBase>> {
  return tmdbFetch('/discover/tv', params as Record<string, string | number | boolean>);
}

// ─── Search ───────────────────────────────────────────────────────────────────

export interface SearchMultiResult {
  page: number;
  results: TMDBTrendingItem[];
  total_pages: number;
  total_results: number;
}

/** GET /search/multi */
export async function searchMulti(
  query: string,
  page = 1
): Promise<SearchMultiResult> {
  return tmdbFetch('/search/multi', { query, page }, 60);
}

/** GET /search/movie */
export async function searchMovies(
  query: string,
  page = 1
): Promise<TMDBPaginatedResponse<TMDBMovieBase>> {
  return tmdbFetch('/search/movie', { query, page }, 60);
}

/** GET /search/tv */
export async function searchSeries(
  query: string,
  page = 1
): Promise<TMDBPaginatedResponse<TMDBSeriesBase>> {
  return tmdbFetch('/search/tv', { query, page }, 60);
}

/** GET /search/person */
export async function searchPeople(
  query: string,
  page = 1
): Promise<TMDBPaginatedResponse<TMDBPersonBase>> {
  return tmdbFetch('/search/person', { query, page }, 60);
}

// ─── Genres ───────────────────────────────────────────────────────────────────

/** GET /genre/movie/list */
export async function getMovieGenres(): Promise<TMDBGenreList> {
  return tmdbFetch('/genre/movie/list', {}, 86400);
}

/** GET /genre/tv/list */
export async function getSeriesGenres(): Promise<TMDBGenreList> {
  return tmdbFetch('/genre/tv/list', {}, 86400);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Get the official trailer YouTube key for a movie or series.
 * Returns null if no official trailer is found.
 */
export function getOfficialTrailerKey(videos: TMDBVideosResponse): string | null {
  const trailers = videos.results.filter(
    (v) => v.site === 'YouTube' && v.type === 'Trailer' && v.official
  );
  if (trailers.length > 0) return trailers[0].key;

  // Fallback: any YouTube trailer
  const anyTrailer = videos.results.find(
    (v) => v.site === 'YouTube' && v.type === 'Trailer'
  );
  return anyTrailer?.key ?? null;
}

/**
 * Get watch providers for a specific country (defaults to IN for Indian market).
 */
export function getWatchProvidersForCountry(
  providers: TMDBWatchProvidersResponse,
  countryCode = 'IN'
) {
  return providers.results[countryCode] ?? null;
}

/**
 * Full detail fetch for a movie — merges details, credits, videos, and watch providers.
 */
export async function getMovieFull(id: number | string) {
  const [movie, credits, videos, watchProviders] = await Promise.all([
    getMovie(id),
    getMovieCredits(id),
    getMovieVideos(id),
    getMovieWatchProviders(id),
  ]);
  return { movie, credits, videos, watchProviders };
}

/**
 * Full detail fetch for a series — merges details, credits, videos, and watch providers.
 */
export async function getSeriesFull(id: number | string) {
  const [series, credits, videos, watchProviders] = await Promise.all([
    getSeries(id),
    getSeriesCredits(id),
    getSeriesVideos(id),
    getSeriesWatchProviders(id),
  ]);
  return { series, credits, videos, watchProviders };
}

/**
 * Home page data — all rails in a single multi-fetch.
 */
export async function getHomeData() {
  const [trending, trendingMovies, trendingSeries, topRated, nowPlaying] = await Promise.all([
    getTrending('week'),
    getTrendingMovies('week'),
    getTrendingSeries('week'),
    getTopRatedMovies(),
    getNowPlayingMovies(),
  ]);
  return { trending, trendingMovies, trendingSeries, topRated, nowPlaying };
}

// ─── Discover by genre / network / company ────────────────────────────────────

/** GET /discover/movie filtered by a single genre id. */
export async function getMoviesByGenre(genreId: number, page = 1) {
  return tmdbFetch<TMDBPaginatedResponse<TMDBMovieBase>>('/discover/movie', {
    with_genres: genreId,
    sort_by: 'popularity.desc',
    'vote_count.gte': 100,
    page,
  });
}

/** GET /discover/tv filtered by a single genre id (optionally by language, e.g. anime). */
export async function getSeriesByGenre(
  genreId: number,
  page = 1,
  originalLanguage?: string
) {
  return tmdbFetch<TMDBPaginatedResponse<TMDBSeriesBase>>('/discover/tv', {
    with_genres: genreId,
    sort_by: 'popularity.desc',
    'vote_count.gte': 50,
    with_original_language: originalLanguage,
    page,
  });
}

/** GET /discover/tv by TV network (e.g. Netflix=213, Disney+=2739). */
export async function getSeriesByNetwork(networkId: number, page = 1) {
  return tmdbFetch<TMDBPaginatedResponse<TMDBSeriesBase>>('/discover/tv', {
    with_networks: networkId,
    sort_by: 'popularity.desc',
    page,
  });
}

/** GET /discover/movie by production company (e.g. Marvel Studios=420, Disney=2). */
export async function getMoviesByCompany(companyId: number, page = 1) {
  return tmdbFetch<TMDBPaginatedResponse<TMDBMovieBase>>('/discover/movie', {
    with_companies: companyId,
    sort_by: 'popularity.desc',
    page,
  });
}

// ─── Hero slides (enriched with runtime + genre names) ────────────────────────

export interface HeroSlide {
  id: number;
  mediaType: 'movie' | 'tv';
  title: string;
  overview: string;
  backdropUrl: string | null;
  posterUrl: string | null;
  releaseYear: string;
  rating: number;
  genres: string[];
  /** Human runtime, e.g. "2h 14m" or "45m" — null when unknown. */
  runtime: string | null;
  href: string;
}

function formatRuntime(minutes: number | null | undefined): string | null {
  if (!minutes || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}

/**
 * Build up to `limit` enriched hero slides for a media type. Fetches full
 * details for each item (in parallel) to obtain runtime + genre names.
 */
export async function buildHeroSlides(
  items: Array<TMDBMovieBase | TMDBSeriesBase>,
  mediaType: 'movie' | 'tv',
  limit = 5
): Promise<HeroSlide[]> {
  const BACKDROP = `${TMDB_IMAGE_BASE}/w1280`;
  const POSTER = `${TMDB_IMAGE_BASE}/w500`;
  const picked = items.filter((i) => i.backdrop_path).slice(0, limit);

  const slides = await Promise.all(
    picked.map(async (item) => {
      try {
        if (mediaType === 'movie') {
          const m = await getMovie(item.id);
          return {
            id: m.id,
            mediaType: 'movie' as const,
            title: m.title,
            overview: m.overview,
            backdropUrl: m.backdrop_path ? `${BACKDROP}${m.backdrop_path}` : null,
            posterUrl: m.poster_path ? `${POSTER}${m.poster_path}` : null,
            releaseYear: m.release_date?.slice(0, 4) ?? '',
            rating: Math.round(m.vote_average * 10) / 10,
            genres: m.genres?.map((g) => g.name).slice(0, 3) ?? [],
            runtime: formatRuntime(m.runtime),
            href: `/movie/${m.id}`,
          } satisfies HeroSlide;
        }
        const s = await getSeries(item.id);
        return {
          id: s.id,
          mediaType: 'tv' as const,
          title: s.name,
          overview: s.overview,
          backdropUrl: s.backdrop_path ? `${BACKDROP}${s.backdrop_path}` : null,
          posterUrl: s.poster_path ? `${POSTER}${s.poster_path}` : null,
          releaseYear: s.first_air_date?.slice(0, 4) ?? '',
          rating: Math.round(s.vote_average * 10) / 10,
          genres: s.genres?.map((g) => g.name).slice(0, 3) ?? [],
          runtime:
            formatRuntime(s.episode_run_time?.[0]) ??
            (s.number_of_seasons
              ? `${s.number_of_seasons} Season${s.number_of_seasons > 1 ? 's' : ''}`
              : null),
          href: `/series/${s.id}`,
        } satisfies HeroSlide;
      } catch {
        return null;
      }
    })
  );

  return slides.filter(Boolean) as HeroSlide[];
}

// Genre / network / company ids used on the home page.
const GENRE = { action: 28, comedy: 35, horror: 27, scifi: 878, drama: 18, animation: 16 } as const;
const NETWORK = { netflix: 213 } as const;
const COMPANY = { marvel: 420, disney: 2 } as const;

/**
 * Full home-page payload: enriched hero slides + every content rail.
 * All requests run in parallel. Individual failures degrade gracefully
 * (missing rails simply render nothing).
 */
export async function getHomePageData() {
  const empty = { results: [] as never[], page: 1, total_pages: 0, total_results: 0 };
  const safe = <T>(p: Promise<T>, fallback: T): Promise<T> => p.catch(() => fallback);

  const [
    trending,
    trendingMovies,
    trendingSeries,
    topRatedMovies,
    nowPlaying,
    onAir,
    upcoming,
    popularMovies,
    action,
    comedy,
    horror,
    scifi,
    drama,
    anime,
    netflix,
    disney,
    marvel,
  ] = await Promise.all([
    safe(getTrending('week'), empty as any),
    safe(getTrendingMovies('week'), empty as any),
    safe(getTrendingSeries('week'), empty as any),
    safe(getTopRatedMovies(), empty as any),
    safe(getNowPlayingMovies(), empty as any),
    safe(getOnAirSeries(), empty as any),
    safe(getUpcomingMovies(), empty as any),
    safe(getPopularMovies(), empty as any),
    safe(getMoviesByGenre(GENRE.action), empty as any),
    safe(getMoviesByGenre(GENRE.comedy), empty as any),
    safe(getMoviesByGenre(GENRE.horror), empty as any),
    safe(getMoviesByGenre(GENRE.scifi), empty as any),
    safe(getMoviesByGenre(GENRE.drama), empty as any),
    safe(getSeriesByGenre(GENRE.animation, 1, 'ja'), empty as any),
    safe(getSeriesByNetwork(NETWORK.netflix), empty as any),
    safe(getMoviesByCompany(COMPANY.disney), empty as any),
    safe(getMoviesByCompany(COMPANY.marvel), empty as any),
  ]);

  // Enrich hero carousels (top 5 each) — parallelised inside the builders.
  const [heroMovies, heroSeries] = await Promise.all([
    buildHeroSlides(trendingMovies.results, 'movie', 5).catch(() => []),
    buildHeroSlides(trendingSeries.results, 'tv', 5).catch(() => []),
  ]);

  // Merge into one alternating carousel: movie, series, movie, series… (up to 10 slides).
  const heroAll: HeroSlide[] = [];
  const maxLen = Math.max(heroMovies.length, heroSeries.length);
  for (let i = 0; i < maxLen && heroAll.length < 10; i++) {
    if (i < heroMovies.length) heroAll.push(heroMovies[i]);
    if (i < heroSeries.length && heroAll.length < 10) heroAll.push(heroSeries[i]);
  }

  return {
    heroAll,
    trending,
    trendingMovies,
    trendingSeries,
    topRatedMovies,
    nowPlaying,
    onAir,
    upcoming,
    popularMovies,
    action,
    comedy,
    horror,
    scifi,
    drama,
    anime,
    netflix,
    disney,
    marvel,
  };
}

/**
 * Anime page payload — all TMDB fetches for /anime in one place.
 * Filters: with_original_language=ja, with_genres includes 16 (Animation).
 */
export async function getAnimePageData(opts: {
  page?: number;
  sortBy?: string;
  genres?: string;
  yearFrom?: string;
  yearTo?: string;
  minRating?: string;
} = {}) {
  const { page = 1, sortBy = 'popularity.desc', genres, yearFrom, yearTo, minRating } = opts;
  const empty = { results: [] as TMDBSeriesBase[], page: 1, total_pages: 0, total_results: 0 };
  const s = <T>(p: Promise<T>, fb: T): Promise<T> => p.catch(() => fb);

  const ANIM = 16;
  const gridParams: DiscoverSeriesParams = {
    page,
    sort_by: sortBy,
    with_genres: genres || String(ANIM),
    with_original_language: 'ja',
    'first_air_date.gte': yearFrom ? `${yearFrom}-01-01` : undefined,
    'first_air_date.lte': yearTo   ? `${yearTo}-12-31`   : undefined,
    'vote_average.gte':  minRating  ? parseFloat(minRating) : undefined,
  };

  const [gridRes, genresRes, trendingRes, topAiringRes, popularRes, romanceRes, actionRes, scifiRes, upcomingRes] = await Promise.all([
    discoverSeries(gridParams),
    getSeriesGenres(),
    s(getTrendingSeries('week'), empty),
    s(getSeriesByGenre(ANIM, 1, 'ja'), empty),
    s(discoverSeries({ with_genres: String(ANIM), with_original_language: 'ja', sort_by: 'vote_count.desc', page: 1 }), empty),
    s(discoverSeries({ with_genres: `${ANIM},10749`, with_original_language: 'ja', sort_by: 'popularity.desc', page: 1 }), empty),
    s(discoverSeries({ with_genres: `${ANIM},28`,   with_original_language: 'ja', sort_by: 'popularity.desc', page: 1 }), empty),
    s(discoverSeries({ with_genres: `${ANIM},10765`, with_original_language: 'ja', sort_by: 'popularity.desc', page: 1 }), empty),
    s(discoverSeries({ with_genres: String(ANIM), with_original_language: 'ja', sort_by: 'first_air_date.desc', page: 1 }), empty),
  ]);

  const trendingAnime = (trendingRes.results as TMDBSeriesBase[])
    .filter((s) => (s as any).original_language === 'ja')
    .slice(0, 5);

  const heroSource = trendingAnime.length >= 3 ? trendingAnime : topAiringRes.results.slice(0, 5);
  const heroSlides = await buildHeroSlides(heroSource, 'tv', 5).catch(() => [] as HeroSlide[]);

  return {
    heroSlides,
    grid:       gridRes,
    genres:     genresRes.genres,
    topAiring:  topAiringRes.results.slice(0, 20),
    popular:    popularRes.results.slice(0, 20),
    romance:    romanceRes.results.slice(0, 20),
    action:     actionRes.results.slice(0, 20),
    scifi:      scifiRes.results.slice(0, 20),
    upcoming:   upcomingRes.results.slice(0, 20),
  };
}

// ─── Streaming platform IDs ───────────────────────────────────────────────────
// TMDB watch-provider IDs (IN region)
// Netflix=8, Amazon Prime Video=119, Disney+=122, Hotstar=122 (Star/Hotstar=392)
const PROVIDER = {
  netflix:  8,
  prime:    119,
  disney:   122,
  hotstar:  392, // Star / Disney+ Hotstar (India)
  appletv:  350, // Apple TV+
} as const;

/** Top 10 trending series on a given watch-provider (by popularity). */
export async function getTop10ByProvider(
  providerId: number,
  mediaType: 'movie' | 'tv' = 'tv',
  region = 'IN'
) {
  const empty = { results: [] as (TMDBMovieBase | TMDBSeriesBase)[] };
  try {
    if (mediaType === 'tv') {
      const res = await tmdbFetch<TMDBPaginatedResponse<TMDBSeriesBase>>('/discover/tv', {
        with_watch_providers: providerId,
        watch_region: region,
        sort_by: 'popularity.desc',
        'vote_count.gte': 20,
        page: 1,
      });
      return { results: res.results.slice(0, 10) };
    }
    const res = await tmdbFetch<TMDBPaginatedResponse<TMDBMovieBase>>('/discover/movie', {
      with_watch_providers: providerId,
      watch_region: region,
      sort_by: 'popularity.desc',
      'vote_count.gte': 20,
      page: 1,
    });
    return { results: res.results.slice(0, 10) };
  } catch { return empty; }
}

/**
 * Full platform page data — hero slides + multiple content rails.
 */
export async function getPlatformPageData(platform: 'netflix' | 'prime' | 'disney' | 'hotstar' | 'appletv') {
  const pid = PROVIDER[platform];
  const empty = { results: [] as any[], page: 1, total_pages: 0, total_results: 0 };
  const s = <T>(p: Promise<T>, fb: T): Promise<T> => p.catch(() => fb);

  const [top10TV, top10Movies, popularTV, popularMovies, trendingTV] = await Promise.all([
    s(getTop10ByProvider(pid, 'tv'),    { results: [] }),
    s(getTop10ByProvider(pid, 'movie'), { results: [] }),
    s(tmdbFetch<TMDBPaginatedResponse<TMDBSeriesBase>>('/discover/tv', {
        with_watch_providers: pid, watch_region: 'IN',
        sort_by: 'vote_average.desc', 'vote_count.gte': 100, page: 1,
      }), empty),
    s(tmdbFetch<TMDBPaginatedResponse<TMDBMovieBase>>('/discover/movie', {
        with_watch_providers: pid, watch_region: 'IN',
        sort_by: 'vote_average.desc', 'vote_count.gte': 100, page: 1,
      }), empty),
    s(getTrendingSeries('week'), empty),
  ]);

  // Build hero from top10 TV items that have a backdrop
  const heroSource = (top10TV.results as TMDBSeriesBase[]).filter(i => i.backdrop_path).slice(0, 5);
  const heroSlides = await buildHeroSlides(heroSource, 'tv', 5).catch(() => [] as HeroSlide[]);

  return {
    heroSlides,
    top10TV:       (top10TV.results    as TMDBSeriesBase[]).slice(0, 10),
    top10Movies:   (top10Movies.results as TMDBMovieBase[]).slice(0, 10),
    popularTV:     (popularTV.results   as TMDBSeriesBase[]).slice(0, 20),
    popularMovies: (popularMovies.results as TMDBMovieBase[]).slice(0, 20),
  };
}

/** Quick home-page top-10 fetch for all 4 platforms in parallel. */
export async function getAllPlatformTop10() {
  const s = <T>(p: Promise<T>, fb: T): Promise<T> => p.catch(() => fb);
  const empty = { results: [] as any[] };
  const [netflixTV, primeTV, disneyTV, hotstarTV, appletvTV] = await Promise.all([
    s(getTop10ByProvider(PROVIDER.netflix, 'tv'),  empty),
    s(getTop10ByProvider(PROVIDER.prime,   'tv'),  empty),
    s(getTop10ByProvider(PROVIDER.disney,  'tv'),  empty),
    s(getTop10ByProvider(PROVIDER.hotstar, 'tv'),  empty),
    s(getTop10ByProvider(PROVIDER.appletv, 'tv'),  empty),
  ]);
  return {
    netflixTop10: netflixTV.results  as TMDBSeriesBase[],
    primeTop10:   primeTV.results    as TMDBSeriesBase[],
    disneyTop10:  disneyTV.results   as TMDBSeriesBase[],
    hotstarTop10: hotstarTV.results  as TMDBSeriesBase[],
    appletvTop10: appletvTV.results  as TMDBSeriesBase[],
  };
}
