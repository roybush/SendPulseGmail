// Dev server for rendering store screenshots: `npx vite --config store/src/vite.config.mjs`
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: here('.'),
  publicDir: here('../../public'),
  plugins: [vue()],
  server: { port: 5299, strictPort: true },
});
