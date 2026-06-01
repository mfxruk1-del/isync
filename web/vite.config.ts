import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Vault',
        short_name: 'Vault',
        description: 'Your private, lossless media vault',
        theme_color: '#0b0f17',
        background_color: '#0b0f17',
        display: 'standalone',
        orientation: 'portrait',
        id: '/',
        scope: '/',
        start_url: '/',
        // On Chromium, let the installed app capture in-scope links (like share
        // links) and open them in the app instead of the browser.
        handle_links: 'preferred',
        launch_handler: { client_mode: 'navigate-existing' },
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  // During local development, forward /api calls to the backend on port 3000.
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
