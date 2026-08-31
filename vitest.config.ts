import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// إعداد اختبارات رِفق
// بيئة 'node' الافتراضية مستقرة وسريعة لمحركات المنطق الخالص.
// أي اختبار يحتاج DOM يعلن ذلك بـ: // @vitest-environment jsdom
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: ['tests/e2e/**'],
    css: false,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true
      }
    },
    testTimeout: 15000,
    hookTimeout: 15000
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});