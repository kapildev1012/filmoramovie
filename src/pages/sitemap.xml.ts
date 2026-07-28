// src/pages/sitemap.xml.ts — Dynamic XML sitemap (SSR endpoint)
import type { APIRoute } from 'astro';
import { getTrendingMovies, getTrendingSeries } from '../lib/tmdb';

const SITE = 'https://filmoramovie.duckdns.org';

interface UrlEntry {
  loc: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
}

// ── Static, always-present routes ──────────────────────────────
const STATIC_ROUTES: UrlEntry[] = [
  { loc: '/',          changefreq: 'daily',   priority: 1.0 },
  { loc: '/movies',    changefreq: 'daily',   priority: 0.9 },
  { loc: '/series',    changefreq: 'daily',   priority: 0.9 },
  { loc: '/anime',     changefreq: 'daily',   priority: 0.8 },
  { loc: '/netflix',   changefreq: 'daily',   priority: 0.8 },
  { loc: '/prime',     changefreq: 'daily',   priority: 0.8 },
  { loc: '/disney',    changefreq: 'daily',   priority: 0.8 },
  { loc: '/hotstar',   changefreq: 'daily',   priority: 0.8 },
  { loc: '/appletv',   changefreq: 'daily',   priority: 0.8 },
  { loc: '/search',    changefreq: 'weekly',  priority: 0.6 },
  { loc: '/watchlist', changefreq: 'monthly', priority: 0.4 },
  { loc: '/about',     changefreq: 'monthly', priority: 0.5 },
  { loc: '/contact',   changefreq: 'monthly', priority: 0.5 },
  { loc: '/privacy',   changefreq: 'yearly',  priority: 0.3 },
  { loc: '/terms',     changefreq: 'yearly',  priority: 0.3 },
];

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function urlTag(entry: UrlEntry, lastmod: string): string {
  const parts = [`    <loc>${xmlEscape(SITE + entry.loc)}</loc>`, `    <lastmod>${lastmod}</lastmod>`];
  if (entry.changefreq) parts.push(`    <changefreq>${entry.changefreq}</changefreq>`);
  if (entry.priority !== undefined) parts.push(`    <priority>${entry.priority.toFixed(1)}</priority>`);
  return `  <url>\n${parts.join('\n')}\n  </url>`;
}

export const GET: APIRoute = async () => {
  const lastmod = new Date().toISOString().split('T')[0];
  const entries: UrlEntry[] = [...STATIC_ROUTES];

  // Append trending movie + series detail pages (non-fatal if TMDB fails).
  try {
    const [movies, series] = await Promise.all([
      getTrendingMovies('week').catch(() => ({ results: [] })),
      getTrendingSeries('week').catch(() => ({ results: [] })),
    ]);

    for (const m of movies.results.slice(0, 20)) {
      if (m?.id) entries.push({ loc: `/movie/${m.id}`, changefreq: 'weekly', priority: 0.7 });
    }
    for (const s of series.results.slice(0, 20)) {
      if (s?.id) entries.push({ loc: `/series/${s.id}`, changefreq: 'weekly', priority: 0.7 });
    }
  } catch {
    // Ignore — static routes still ship.
  }

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    entries.map((e) => urlTag(e, lastmod)).join('\n') +
    `\n</urlset>\n`;

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      // Cache at the edge for an hour, allow stale for a day.
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
};
