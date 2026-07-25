// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://filmoramovie.com',
  output: 'server',
  adapter: vercel(),
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
