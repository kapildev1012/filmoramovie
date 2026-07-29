/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

// ── Cloudflare-specific types (only present when DEPLOY_TARGET !== 'vercel') ──
// Guard the triple-slash reference so TypeScript doesn't error on Vercel builds
// where @cloudflare/workers-types may not provide all globals.
/// <reference types="@cloudflare/workers-types" />

// Cloudflare runtime bindings available at request time via
// `Astro.locals.runtime.env` (and `context.locals.runtime.env` in API routes).
interface Env {
  // D1 database binding (see wrangler.toml [[d1_databases]]).
  DB: D1Database;

  // NexS (nexos.ai) secrets — read via locals.runtime.env because the key name
  // `NexS_api` isn't a valid astro:env identifier (must be UPPER_SNAKE_CASE).
  NexS_api?: string;
  NEXS_MODEL?: string;
}

type CFRuntime = import('@astrojs/cloudflare').Runtime<Env>;

/**
 * Opt-in verbose logging for the TMDB client's retry loop (src/lib/tmdb.ts).
 * Set `globalThis.__TMDB_DEBUG__ = true` in a dev session to print each failed
 * attempt with its stack; unset in production.
 */
declare var __TMDB_DEBUG__: boolean | undefined;

/**
 * Build fingerprint injected by Vite (`define` in astro.config.mjs). Used by
 * src/middleware.ts to version the edge HTML cache key, so a new build never
 * serves HTML rendered by the previous one.
 */
declare const __BUILD_ID__: string;

declare namespace App {
  interface Locals extends Partial<CFRuntime> {
    /** @deprecated Prefer cfContext plus astro:env; retained for existing D1 routes. */
    runtime: {
      env: Env;
      ctx: ExecutionContext;
    };
    /**
     * Cloudflare execution context. Only present on Cloudflare deployments.
     * Guarded as optional so Vercel code can safely check for it.
     */
    cfContext?: {
      waitUntil(promise: Promise<any>): void;
    };
  }
}
