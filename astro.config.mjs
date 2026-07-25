// @ts-check
import { defineConfig, envField } from 'astro/config';
import react from '@astrojs/react';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://filmoramovie.com',
  output: 'server',
  // Cloudflare Workers adapter (v14, Astro 7 compatible). `platformProxy`
  // exposes bindings (e.g. the D1 `DB` binding) on `Astro.locals.runtime.env`
  // during `astro dev`.
  adapter: cloudflare({
    platformProxy: { enabled: true },
  }),
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
  // Preload internal links as they enter the viewport so client-side
  // (view-transition) navigation between pages completes in well under 250ms.
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },
  integrations: [
    react(),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
