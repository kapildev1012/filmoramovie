// src/pages/api/tv/[id]/season/[season].ts — TMDB season-details proxy.
//
// Returns the episode list for a given series + season so the SeriesPlayer
// island can lazily load episodes on the client without exposing TMDB_API_KEY.
import type { APIRoute } from 'astro';
import { getSeasonDetails } from '../../../../../lib/tmdb';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const { id, season } = params;
  if (!id || !/^\d+$/.test(id) || !season || !/^\d+$/.test(season)) {
    return new Response(JSON.stringify({ error: 'Invalid id/season', episodes: [] }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const data = await getSeasonDetails(id, Number(season));
    // Trim to just what the client needs.
    const episodes = (data.episodes ?? []).map((ep) => ({
      episode_number: ep.episode_number,
      name: ep.name,
      overview: ep.overview,
      still_path: ep.still_path,
      air_date: ep.air_date,
      runtime: ep.runtime,
      vote_average: ep.vote_average,
    }));
    return new Response(JSON.stringify({ episodes }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (error) {
    console.error('[season-api] Failed to load season', { id, season, error });
    return new Response(JSON.stringify({ error: 'Failed to load season', episodes: [] }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
