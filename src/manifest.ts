import { defineManifest } from '@crxjs/vite-plugin';
import pkg from '../package.json' with { type: 'json' };

// Name and description come from public/_locales/<lang>/messages.json.

export const manifest = {
  manifest_version: 3,
  name: '__MSG_extName__',
  description: '__MSG_extDescription__',
  default_locale: 'en',
  version: pkg.version,
  icons: {
    16: 'icons/icon-16.png',
    32: 'icons/icon-32.png',
    48: 'icons/icon-48.png',
    128: 'icons/icon-128.png',
  },
  action: {
    default_icon: { 16: 'icons/icon-16.png', 32: 'icons/icon-32.png' },
    default_title: '__MSG_extName__',
    default_popup: 'src/options/index.html',
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
  // Asked for only when the user sets up enrichment with that provider.
  optional_host_permissions: ['https://api.hunter.io/*', 'https://api.apollo.io/*'],
  // The settings page is embedded in the Gmail panel as an iframe so secrets never touch Gmail's DOM.
  web_accessible_resources: [
    { resources: ['icons/*', 'src/options/index.html'], matches: ['https://mail.google.com/*'] },
  ],
} satisfies chrome.runtime.ManifestV3;

// Firefox has no service workers for extensions (it runs the same module as an event page),
// prefers `options_ui`, and needs an add-on ID plus a data collection declaration for AMO.
const { service_worker, ...background } = manifest.background;
const { options_page, ...shared } = manifest;

export const firefoxManifest = {
  ...shared,
  background: { ...background, scripts: [service_worker] },
  options_ui: { page: options_page, open_in_tab: true },
  browser_specific_settings: {
    gecko: {
      id: 'sendpulse-gmail@roybush.github.io',
      // 128: scripting.executeScript into the MAIN world (InboxSDK's pageWorld.js).
      // 140: data_collection_permissions.
      strict_min_version: '140.0',
      data_collection_permissions: {
        // Contact names, emails and signature details go to SendPulse (and, if the user adds a key,
        // to Hunter/Apollo); so do the user's API credentials. "Save email to CRM" sends email text.
        required: [
          'personallyIdentifyingInfo' as const,
          'authenticationInfo' as const,
          'personalCommunications' as const,
        ],
      },
    },
  },
};

export default defineManifest(manifest);
export const firefox = defineManifest(firefoxManifest);
