import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// رِفق — Vite configuration
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'رِفق',
        short_name: 'رِفق',
        description: 'رفيق يرافقك في تنظيم الحياة والتعلم والعمل والقلب',
        theme_color: '#f5efe6',
        background_color: '#f5efe6',
        dir: 'rtl',
        lang: 'ar',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
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