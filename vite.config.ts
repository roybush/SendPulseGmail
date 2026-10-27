import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { crx } from '@crxjs/vite-plugin';
import manifest from './src/manifest';

export default defineConfig({
  plugins: [vue(), crx({ manifest })],
  server: {
    cors: { origin: [/chrome-extension:\/\//] },
  },
});
