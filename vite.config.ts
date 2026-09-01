import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// رِفق — Vite configuration
// DEPLOY_BASE (مثل /Refq/) يُضبط في CI فقط للنشر على GitHub Pages — التطوير المحلي يبقى على '/'
const base = process.env.DEPLOY_BASE ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'pwa-192.png', 'pwa-512.png', 'pwa-512-maskable.png'],
      manifest: {
        // مسارات نسبية — تعمل على الجذر وعلى subpath (GitHub Pages) معًا
        id: '.',
        name: 'رِفق',
        short_name: 'رِفق',
        description: 'رفيق يرافقك في تنظيم الحياة والتعلم والعمل والقلب',
        theme_color: '#f5efe6',
        background_color: '#f5efe6',
        dir: 'rtl',
        lang: 'ar',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: 'pwa-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api\//]
      }
    })
  ],
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});