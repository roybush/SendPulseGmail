import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

// Separate from vite.config.ts so the CRX plugin doesn't run during tests.
export default defineConfig({
  plugins: [vue()],
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
