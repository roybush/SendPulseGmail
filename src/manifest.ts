import { defineManifest } from '@crxjs/vite-plugin';
import pkg from '../package.json' with { type: 'json' };

export const manifest = {
  manifest_version: 3,
  name: 'SendPulse for Gmail',
  description: pkg.description,
  version: pkg.version,
  icons: {
    16: 'icons/icon-16.png',
    128: 'icons/icon-128.png',
  },
  action: {
    default_icon: { 16: 'icons/icon-16.png' },
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['https://mail.google.com/*'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
    },
  ],
  options_page: 'src/options/index.html',
  // `scripting` + Gmail host: InboxSDK injects its page-world script (pageWorld.js) into Gmail.
  permissions: ['storage', 'scripting'],
  host_permissions: ['https://api.sendpulse.com/*', 'https://mail.google.com/'],
  web_accessible_resources: [{ resources: ['icons/*'], matches: ['https://mail.google.com/*'] }],
} satisfies chrome.runtime.ManifestV3;

export default defineManifest(manifest);
