// src/pages/api/watchlist/index.ts — Watchlist add/remove API
import type { APIRoute } from 'astro';
import {
  getSessionFromRequest,
  getProfilesByUserId,
  addToWatchlist,
  removeFromWatchlist,
} from '../../../lib/db';
import { getDB } from '../../../lib/db-driver';

export const POST: APIRoute = async ({ request, locals }) => {
  const db = await getDB(locals);
  const session = await getSessionFromRequest(db, request);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: { tmdbId?: number; mediaType?: string; title?: string; posterPath?: string | null };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { tmdbId, mediaType, title, posterPath } = body;
  if (!tmdbId || !mediaType || !title) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (mediaType !== 'movie' && mediaType !== 'tv') {
    return new Response(JSON.stringify({ error: 'Invalid mediaType' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Use the default profile
  const profiles = await getProfilesByUserId(db, session.user.id);
  const defaultProfile = profiles.find((p) => p.is_default) ?? profiles[0];
  if (!defaultProfile) {
    return new Response(JSON.stringify({ error: 'No profile found' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    await addToWatchlist(db, defaultProfile.id, tmdbId, mediaType, title, posterPath ?? null);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Failed to add to watchlist' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  const db = await getDB(locals);
  const session = await getSessionFromRequest(db, request);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: { tmdbId?: number; mediaType?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { tmdbId, mediaType } = body;
  if (!tmdbId || !mediaType) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (mediaType !== 'movie' && mediaType !== 'tv') {
    return new Response(JSON.stringify({ error: 'Invalid mediaType' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const profiles = await getProfilesByUserId(db, session.user.id);
  const defaultProfile = profiles.find((p) => p.is_default) ?? profiles[0];
  if (!defaultProfile) {
    return new Response(JSON.stringify({ error: 'No profile found' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    await removeFromWatchlist(db, defaultProfile.id, tmdbId, mediaType);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Failed to remove from watchlist' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
