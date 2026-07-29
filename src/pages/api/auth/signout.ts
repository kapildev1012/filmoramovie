// src/pages/api/auth/signout.ts — Sign out (deletes session)
import type { APIRoute } from 'astro';
import { getSessionFromRequest, deleteSession, SESSION_COOKIE } from '../../../lib/db';
import { getDB } from '../../../lib/db-driver';

export const POST: APIRoute = async ({ request, locals }) => {
  const db = await getDB(locals);
  const session = await getSessionFromRequest(db, request);
  if (session) {
    await deleteSession(db, session.id);
  }

  const clearCookie = `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`;
  return new Response(null, {
    status: 302,
    headers: {
      Location: '/',
      'Set-Cookie': clearCookie,
    },
  });
};
