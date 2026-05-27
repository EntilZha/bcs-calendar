// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
//
// GitHub Pages project-site config: the site is served from
// https://<owner>.github.io/<repo>/, so `base` must be the repo name.
// Change `base` (and `site`) if your repository is named differently.
export default defineConfig({
  site: 'https://entilzha.github.io',
  base: '/bcs-calendar/',
  integrations: [react(), sitemap()],

  vite: {
    plugins: [tailwindcss()],
  },
});
