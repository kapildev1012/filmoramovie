/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />
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

declare namespace App {
  interface Locals extends CFRuntime {}
}
