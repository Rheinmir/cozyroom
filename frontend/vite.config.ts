import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      devOptions: { enabled: true },
      workbox: {
        clientsClaim: true,
        runtimeCaching: [
          {
            // Cover images — rarely change, cache aggressively
            urlPattern: /\/api\/covers\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'covers',
              expiration: { maxEntries: 1000, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
          {
            // Artist images — same
            urlPattern: /\/api\/artist-images\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'artist-images',
              expiration: { maxEntries: 500, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
          {
            // Library data — network first, fall back to cache when offline
            urlPattern: /\/api\/(artists|albums|tracks|search|stats)/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-data',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 },
            },
          },
        ],
      },
      manifest: {
        name: 'Cozyroom',
        short_name: 'Cozyroom',
        theme_color: '#8B5CF6',
        background_color: '#121212',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icon-v2-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-v2-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
      '/stream': 'http://localhost:8080',
      '/stream-video': 'http://localhost:8080',
      '/hls': 'http://localhost:8080',
    },
  },
  build: {
    outDir: '../backend/dist',
    emptyOutDir: true,
  },
})
