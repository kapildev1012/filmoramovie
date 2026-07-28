// src/pages/api/search.ts — TMDB search proxy endpoint
import type { APIRoute } from 'astro';
import { searchSuggestions } from '../../lib/tmdb';

export const GET: APIRoute = async ({ url }) => {
  const q = url.searchParams.get('q')?.trim();

  if (!q) {
    return Response.json({ results: [], total_results: 0, total_pages: 0 }, {
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600' },
    });
  }

  try {
    // Typo-tolerant, popularity-ranked suggestions (Google-style "did you mean").
    const results = await searchSuggestions(q, 8);
    return Response.json({ results, total_results: results.length }, {
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600' },
    });
  } catch {
    return Response.json({ error: 'Search failed', results: [] }, {
      status: 502,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
};
