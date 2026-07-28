// @ts-check
import { defineConfig, envField } from 'astro/config';
import react from '@astrojs/react';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';

// Minimal diagnostic config: same adapter/integrations/env, but WITHOUT the
// custom vite.optimizeDeps.include, vite.define, and server.watch overrides.
export default defineConfig({
  site: 'https://filmoramovie.com',
  output: 'server',
  adapter: cloudflare(),
  env: {
    schema: {
      TMDB_API_KEY: envField.string({ context: 'server', access: 'secret' }),
      TMDB_READ_ACCESS_TOKEN: envField.string({ context: 'server', access: 'secret', optional: true }),
      GOOGLE_CLIENT_ID: envField.string({ context: 'server', access: 'secret', optional: true }),
      GOOGLE_CLIENT_SECRET: envField.string({ context: 'server', access: 'secret', optional: true }),
      GOOGLE_REDIRECT_URI: envField.string({ context: 'server', access: 'secret', optional: true }),
      EMBED_API_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      RESEND_API_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      FROM_EMAIL: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
