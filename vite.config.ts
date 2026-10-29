import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { crx } from '@crxjs/vite-plugin';
import manifest, { firefox } from './src/manifest.ts';

// `--mode firefox` builds the Firefox add-on into dist-firefox/; the default mode builds for Chrome.
export default defineConfig(({ mode }) => {
  const isFirefox = mode === 'firefox';
  return {
    plugins: [
      vue(),
      crx(isFirefox ? { manifest: firefox, browser: 'firefox' } : { manifest, browser: 'chrome' }),
    ],
    build: {
      outDir: isFirefox ? 'dist-firefox' : 'dist',
      // InboxSDK alone is ~1 MB; it ships inside the extension, so size matters little.
      chunkSizeWarningLimit: 1500,
    },
    server: {
      cors: { origin: [/chrome-extension:\/\//, /moz-extension:\/\//] },
    },
  };
});
