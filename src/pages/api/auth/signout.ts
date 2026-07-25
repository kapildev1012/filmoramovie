// src/pages/api/auth/signout.ts — Sign out (deletes session)
import type { APIRoute } from 'astro';
import { getSessionFromRequest, deleteSession, SESSION_COOKIE } from '../../../lib/db';

export const POST: APIRoute = async ({ request, locals }) => {
  const db = locals.runtime.env.DB;
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
