import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { crx } from '@crxjs/vite-plugin';
import manifest from './src/manifest.ts';

export default defineConfig({
  plugins: [vue(), crx({ manifest })],
  build: {
    // InboxSDK alone is ~1 MB; it ships inside the extension, so size matters little.
    chunkSizeWarningLimit: 1500,
  },
  server: {
    cors: { origin: [/chrome-extension:\/\//] },
  },
});
