// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// react + tailwind, NO cloudflare adapter (static output).
export default defineConfig({
  integrations: [react()],
  vite: { plugins: [tailwindcss()] },
});
