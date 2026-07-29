// @ts-check
import { defineConfig, envField } from 'astro/config';
import react from '@astrojs/react';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config

// Set NO_HMR=1 (see the `dev:nohmr` npm script) to run the dev server with
// hot-reload completely disabled. Nothing will auto-refresh the page — handy
// when testing the video player, where a reload kills playback. Code changes
// then require a manual browser refresh.
const noHmr = process.env.NO_HMR === '1';

export default defineConfig({
  site: 'https://filmoramovie.duckdns.org',
  output: 'server',
  // Cloudflare Workers adapter (v14, Astro 7 compatible). `platformProxy`
  // exposes bindings (e.g. the D1 `DB` binding) on `Astro.locals.runtime.env`
  // during `astro dev`.
  adapter: cloudflare(),
  // Runtime secrets. On Cloudflare, import.meta.env does NOT contain secrets —
  // astro:env reads them from the Worker runtime env (wrangler secrets / .dev.vars)
  // and from .env locally. Read via `import { NAME } from 'astro:env/server'`.
  env: {
    schema: {
      TMDB_API_KEY: envField.string({ context: 'server', access: 'secret' }),
      TMDB_READ_ACCESS_TOKEN: envField.string({ context: 'server', access: 'secret', optional: true }),
      GOOGLE_CLIENT_ID: envField.string({ context: 'server', access: 'secret', optional: true }),
      GOOGLE_CLIENT_SECRET: envField.string({ context: 'server', access: 'secret', optional: true }),
      GOOGLE_REDIRECT_URI: envField.string({ context: 'server', access: 'secret', optional: true }),
      EMBED_API_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
  // Prefetch just before intent. Viewport prefetch caused content rails to
  // request dozens of SSR pages while scrolling, competing with images/video.
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover',
  },
  integrations: [
    react(),
  ],
  vite: {
    plugins: [tailwindcss()],
    // Build fingerprint, injected into src/middleware.ts as part of the HTML
    // cache key. `caches.default` on Cloudflare survives deploys, so without
    // this a page cached before a change kept being served (stale-while-
    // revalidate keeps it alive for a day) and layout edits looked like they
    // had only landed on some routes. A new build ⇒ a new key ⇒ no stale HTML.
    define: {
      __BUILD_ID__: JSON.stringify(
        process.env.CF_PAGES_COMMIT_SHA ??
          process.env.WORKERS_CI_COMMIT_SHA ??
          Date.now().toString(36)
      ),
    },
    server: {
      // `NO_HMR=1 npm run dev` -> no websocket, no HMR client, no auto reload.
      hmr: noHmr ? false : undefined,
      watch: {
        // Never treat build artefacts as source changes. Running `astro build`
        // or `wrangler` while `astro dev` is up rewrites these directories and
        // used to trigger a "program reload" (and a full page refresh) for
        // every generated file.
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/dist/**',
          '**/.astro/**',
          '**/.wrangler/**',
          '**/.vercel/**',
          '**/.output/**',
        ],
      },
    },
    // Pre-bundle heavy client-island dependencies up front so Vite does not
    // discover them lazily mid-session and trigger a dependency re-optimization,
    // which forces a full-page reload (the "auto-refreshing" behaviour in dev).
    //
    // SCOPED TO THE CLIENT ENVIRONMENT ON PURPOSE. A top-level `optimizeDeps`
    // applies to every Vite environment, including the Cloudflare/workerd SSR
    // one. The SSR optimizer declines to emit some of these (gsap, which is
    // already valid ESM) while the include entry still rewrites SSR imports to
    // `.vite/deps_ssr/<dep>.js?v=…` — a file that is never written. The result
    // was a 500 on every page that server-renders such an island:
    //   "The file does not exist at .../deps_ssr/gsap.js?v=… which is in the
    //    optimize deps directory."
    // These are all browser-island dependencies, so the client environment is
    // the only place they belong.
    environments: {
      client: {
        optimizeDeps: {
          include: [
            // ClientRouter (src/layouts/Layout.astro) and `navigate()` in
            // SearchBar.tsx pull these in only once a page actually renders, so
            // Vite discovered them mid-session and re-optimized -> full page
            // reload. Pre-bundling them at startup keeps the dev server stable.
            'astro/virtual-modules/transitions-router.js',
            'astro/virtual-modules/transitions-events.js',
            'astro/virtual-modules/transitions-swap-functions.js',
            'astro/virtual-modules/transitions-types.js',
            'react',
            'react-dom',
            'three',
            '@react-three/fiber',
            '@react-three/drei',
            'motion',
            'motion/react',
            'framer-motion',
            'gsap',
            'lucide-react',
            'class-variance-authority',
            'tailwind-merge',
          ],
        },
      },
    },
  },
});
