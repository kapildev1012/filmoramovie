// @ts-check
import { defineConfig, envField } from 'astro/config';
import react from '@astrojs/react';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';

// cloudflare adapter WITH platformProxy disabled (no miniflare/workerd in dev).
export default defineConfig({
  site: 'https://filmoramovie.com',
  output: 'server',
  adapter: cloudflare({ platformProxy: { enabled: false } }),
  env: {
    schema: {
      TMDB_API_KEY: envField.string({ context: 'server', access: 'secret' }),
    },
  },
  integrations: [react()],
  vite: { plugins: [tailwindcss()] },
});
