// src/pages/api/search.ts — TMDB search proxy endpoint
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ url }) => {
  const q = url.searchParams.get('q')?.trim();
  const page = url.searchParams.get('page') ?? '1';

  if (!q || q.length < 1) {
    return new Response(JSON.stringify({ results: [], total_results: 0, total_pages: 0 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = import.meta.env.TMDB_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'TMDB API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const tmdbUrl = new URL('https://api.themoviedb.org/3/search/multi');
    tmdbUrl.searchParams.set('api_key', apiKey);
    tmdbUrl.searchParams.set('query', q);
    tmdbUrl.searchParams.set('page', page);
    tmdbUrl.searchParams.set('language', 'en-US');
    tmdbUrl.searchParams.set('include_adult', 'false');

    const res = await fetch(tmdbUrl.toString());
    if (!res.ok) {
      throw new Error(`TMDB ${res.status}`);
    }
    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60, s-maxage=60',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Search failed', results: [] }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
