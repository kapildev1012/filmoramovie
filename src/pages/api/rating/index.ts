// src/pages/api/rating/index.ts — Rating API endpoint
import type { APIRoute } from 'astro';
import { getSessionFromRequest, getProfilesByUserId, setRating, deleteRating } from '../../../lib/db';
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

  let body: { tmdbId?: number; mediaType?: string; rating?: number };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const { tmdbId, mediaType, rating } = body;
  if (!tmdbId || !mediaType || !rating) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  if (mediaType !== 'movie' && mediaType !== 'tv') {
    return new Response(JSON.stringify({ error: 'Invalid mediaType' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  if (rating < 1 || rating > 5) {
    return new Response(JSON.stringify({ error: 'Rating must be 1–5' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const profiles = await getProfilesByUserId(db, session.user.id);
  const profile = profiles.find((p) => p.is_default) ?? profiles[0];
  if (!profile) {
    return new Response(JSON.stringify({ error: 'No profile' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    await setRating(db, profile.id, tmdbId, mediaType, rating);
    return new Response(JSON.stringify({ ok: true, rating }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Failed to set rating' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  const db = await getDB(locals);
  const session = await getSessionFromRequest(db, request);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  let body: { tmdbId?: number; mediaType?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const { tmdbId, mediaType } = body;
  if (!tmdbId || !mediaType) {
    return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const profiles = await getProfilesByUserId(db, session.user.id);
  const profile = profiles.find((p) => p.is_default) ?? profiles[0];
  if (!profile) {
    return new Response(JSON.stringify({ error: 'No profile' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    await deleteRating(db, profile.id, tmdbId, mediaType as 'movie' | 'tv');
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Failed to delete rating' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
