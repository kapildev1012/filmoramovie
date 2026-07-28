// Custom Add-on Features — AI mood-based browsing + time-available filter.
// The NexS_api credential is server-only and is never returned to the browser.
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { discoverMovies } from '../../lib/tmdb';

// Worker secrets (server-only). NexS_api can't use astro:env (not UPPER_SNAKE_CASE),
// so it's read from the Cloudflare Workers runtime env instead.
const workerEnv = env as unknown as { NexS_api?: string; NEXS_MODEL?: string };

export const prerender = false;

const MOODS = {
  light: {
    label: 'Something light',
    genres: '35|10751',
    fallback: 'Easygoing picks with warmth, humor, and a low-stress finish.',
  },
  cozy: {
    label: 'Cozy night',
    genres: '10749|18',
    fallback: 'Comforting stories made for a relaxed night in.',
  },
  thrilling: {
    label: 'Keep me hooked',
    genres: '28|53',
    fallback: 'Fast-moving stories chosen to keep the momentum high.',
  },
  cerebral: {
    label: 'Mind-bending',
    genres: '878|9648',
    fallback: 'Curious, twisty stories that reward close attention.',
  },
  uplifting: {
    label: 'Lift my mood',
    genres: '35|10402',
    fallback: 'Bright, energetic picks with a feel-good pulse.',
  },
  surprise: {
    label: 'Surprise me',
    genres: undefined,
    fallback: 'A popular wildcard mix for when choosing is the hard part.',
  },
} as const;

const ALLOWED_MINUTES = new Set([60, 90, 120, 180]);
const WINDOW_MS = 60_000;
const REQUEST_LIMIT = 8;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

type Mood = keyof typeof MOODS;

interface NexosSelection {
  headline?: unknown;
  summary?: unknown;
  picks?: unknown;
}

interface NexosResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
}

function response(data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

function clientKey(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'anonymous';
}

function consumeRateLimit(key: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const current = rateBuckets.get(key);
  if (!current || current.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }
  if (current.count >= REQUEST_LIMIT) {
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  }
  current.count += 1;
  return { allowed: true, retryAfter: 0 };
}

function cleanText(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== 'string') return fallback;
  const cleaned = value.replace(/[<>]/g, '').trim().slice(0, maxLength);
  return cleaned || fallback;
}

function parseNexosJson(content: string): NexosSelection {
  const normalized = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  return JSON.parse(normalized) as NexosSelection;
}

export const POST: APIRoute = async ({ request }) => {
  const limit = consumeRateLimit(clientKey(request));
  if (!limit.allowed) {
    return response(
      { error: 'Too many mood requests. Please wait a moment and try again.' },
      429,
      { 'Retry-After': String(limit.retryAfter) },
    );
  }

  let body: { mood?: unknown; minutes?: unknown };
  try {
    body = await request.json();
  } catch {
    return response({ error: 'Invalid JSON body.' }, 400);
  }

  const mood = typeof body.mood === 'string' && body.mood in MOODS ? body.mood as Mood : null;
  const minutes = typeof body.minutes === 'number' && ALLOWED_MINUTES.has(body.minutes)
    ? body.minutes
    : null;

  if (!mood || !minutes) {
    return response({ error: 'Choose a supported mood and time window.' }, 400);
  }

  const moodConfig = MOODS[mood];

  try {
    // Pull real, well-known titles: filter to a solid vote floor so we never
    // surface obscure single-vote entries, and vary the page (1-3) so repeat
    // taps feel fresh while every page stays high-quality.
    const catalog = await discoverMovies({
      sort_by: mood === 'surprise' ? 'popularity.desc' : 'vote_average.desc',
      with_genres: moodConfig.genres,
      'with_runtime.lte': minutes,
      'vote_average.gte': 6,
      'vote_count.gte': 200,
      page: Math.floor(Math.random() * 3) + 1,
    });

    const candidates = catalog.results
      .filter((item) => item.poster_path && item.overview)
      .slice(0, 12);

    if (candidates.length === 0) {
      return response({ error: 'No matching titles are available right now.' }, 404);
    }

    let headline = `${moodConfig.label} · under ${minutes} min`;
    let summary: string = moodConfig.fallback;
    let selectedIds: number[] = [];
    let reasons = new Map<number, string>();
    let source: 'nexos' | 'curated' = 'curated';

    const nexosKey = workerEnv.NexS_api;
    if (nexosKey) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12_000);
      try {
        const candidateContext = candidates.map((item) => ({
          id: item.id,
          title: item.title,
          overview: item.overview.slice(0, 420),
          rating: Math.round(item.vote_average * 10) / 10,
          year: item.release_date?.slice(0, 4) || null,
        }));

        const nexos = await fetch('https://api.nexos.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': nexosKey,
            'User-Agent': 'FilmoraMovie/1.0 (+https://filmoramovie.com)',
          },
          body: JSON.stringify({
            model: workerEnv.NEXS_MODEL || 'GPT 4.1 mini',
            store: false,
            temperature: 0.35,
            max_completion_tokens: 700,
            response_format: { type: 'json_object' },
            metadata: { feature: 'mobile_mood_match' },
            messages: [
              {
                role: 'system',
                content: 'You are a concise movie curator. Select only IDs supplied by the user. Return valid JSON with headline, summary, and picks. picks must be an array of exactly 6 objects shaped {"id": number, "why": string}. Keep every why under 90 characters. Never invent titles or IDs.',
              },
              {
                role: 'user',
                content: JSON.stringify({
                  task: 'Choose six films matching this mood and available-time preference.',
                  mood: moodConfig.label,
                  maximumMinutes: minutes,
                  candidates: candidateContext,
                }),
              },
            ],
          }),
          signal: controller.signal,
        });

        if (!nexos.ok) throw new Error(`Nexos ${nexos.status}`);
        const payload = await nexos.json() as NexosResponse;
        const content = payload.choices?.[0]?.message?.content;
        if (!content) throw new Error('Nexos returned no content');

        const selection = parseNexosJson(content);
        const candidateIds = new Set(candidates.map((item) => item.id));
        const rawPicks = Array.isArray(selection.picks) ? selection.picks : [];
        for (const raw of rawPicks) {
          if (!raw || typeof raw !== 'object') continue;
          const id = (raw as { id?: unknown }).id;
          const why = (raw as { why?: unknown }).why;
          if (typeof id !== 'number' || !candidateIds.has(id) || selectedIds.includes(id)) continue;
          selectedIds.push(id);
          reasons.set(id, cleanText(why, moodConfig.fallback, 90));
          if (selectedIds.length === 6) break;
        }

        if (selectedIds.length > 0) {
          headline = cleanText(selection.headline, headline, 80);
          summary = cleanText(selection.summary, summary, 180);
          source = 'nexos';
        }
      } catch {
        // The catalog remains useful if NexS is unavailable, out of credits, or misconfigured.
      } finally {
        clearTimeout(timeout);
      }
    }

    for (const candidate of candidates) {
      if (selectedIds.length >= 6) break;
      if (!selectedIds.includes(candidate.id)) selectedIds.push(candidate.id);
    }

    const byId = new Map(candidates.map((item) => [item.id, item]));
    const picks = selectedIds.slice(0, 6).flatMap((id) => {
      const item = byId.get(id);
      if (!item) return [];
      return [{
        id: item.id,
        mediaType: 'movie' as const,
        title: item.title,
        year: item.release_date?.slice(0, 4) || '',
        rating: Math.round(item.vote_average * 10) / 10,
        overview: item.overview.slice(0, 180),
        posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : null,
        href: `/movie/${item.id}`,
        why: reasons.get(item.id) || moodConfig.fallback,
      }];
    });

    return response({ headline, summary, source, picks });
  } catch {
    return response({ error: 'Mood matching is temporarily unavailable.' }, 502);
  }
};
