// src/lib/embed.ts — Embed / streaming provider config (CodeSpecter).
//
// Get a movie API key at: https://api.codespecters.com/api
// Note: CodeSpecter API keys expire ~30 days after issuance — rotate before then.
//
// SECURITY: the API key is a server-only secret. It is read from the
// EMBED_API_KEY environment variable (see .env / .env.example) and must never
// be hardcoded here or shipped to the browser. Build embed URLs on the server
// (e.g. inside an Astro page frontmatter or an /api route), exactly how
// src/lib/tmdb.ts keeps TMDB_API_KEY server-side. `import.meta.env.EMBED_API_KEY`
// (no PUBLIC_ prefix) is only available server-side, so it will be `undefined`
// if imported into client code.

/** CodeSpecter API base URL. */
export const EMBED_BASE = 'https://api.codespecters.com';

/** TMDB poster/thumbnail image base (w300). */
export const IMG_BASE = 'https://image.tmdb.org/t/p/w300';

/** TMDB large image base (w780). */
export const IMG_BASE_LG = 'https://image.tmdb.org/t/p/w780';

/**
 * Server-only CodeSpecter API key. Throws if the environment variable is unset
 * so misconfiguration fails loudly instead of silently sending requests
 * without credentials.
 */
export function getEmbedApiKey(): string {
  const key = import.meta.env.EMBED_API_KEY;
  if (!key) {
    throw new Error('EMBED_API_KEY environment variable is not set.');
  }
  return key as string;
}
