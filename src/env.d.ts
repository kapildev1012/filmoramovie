/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

// Cloudflare Workers bindings available at request time via:
//   import { env } from 'cloudflare:workers';
//   const db = (env as unknown as Env).DB;
interface Env {
  // D1 database binding (see wrangler.toml [[d1_databases]]).
  DB: D1Database;

  // NexS (nexos.ai) secrets — read via cloudflare:workers env because the key
  // name `NexS_api` isn't a valid astro:env identifier (must be UPPER_SNAKE_CASE).
  NexS_api?: string;
  NEXS_MODEL?: string;
}

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
  interface Locals {
    cfContext: ExecutionContext;
  }
}
