// src/pages/api/search-live.ts — instant search feed for the /search page.
//
// Returns the full movie / series / people result sets (not just dropdown
// suggestions) so the page grid can update on every keystroke. With no `q`,
// it answers with trending recommendations instead.
import type { APIRoute } from 'astro';
import { buildLiveSearch, buildRecommended } from '../../lib/liveSearch';

const CACHE = 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600';

export const GET: APIRoute = async ({ url }) => {
  const q = url.searchParams.get('q')?.trim() ?? '';
  const tab = url.searchParams.get('tab');

  try {
    if (!q) {
      const recommended = await buildRecommended();
      return Response.json({ query: '', recommended }, { headers: { 'Cache-Control': CACHE } });
    }
    const payload = await buildLiveSearch(q, tab);
    return Response.json(payload, { headers: { 'Cache-Control': CACHE } });
  } catch {
    return Response.json(
      {
        query: q,
        tab: tab ?? 'all',
        movies: [],
        series: [],
        people: [],
        totals: { movies: 0, series: 0, people: 0 },
        didYouMean: [],
        error: 'Search failed',
      },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    );
  }
};
