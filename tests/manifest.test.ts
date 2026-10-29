import { describe, expect, it } from 'vitest';
import { firefoxManifest, manifest } from '../src/manifest';

describe('manifest', () => {
  it('is Manifest V3', () => {
    expect(manifest.manifest_version).toBe(3);
  });

  it('takes name and description from _locales, English by default', () => {
    expect(manifest.default_locale).toBe('en');
    expect(manifest.name).toBe('__MSG_extName__');
    expect(manifest.description).toBe('__MSG_extDescription__');
  });

  // Chrome Web Store review flags broad permissions; keep this list deliberate.
  it('requests only the permissions we need', () => {
    expect(manifest.permissions).toEqual(['storage', 'scripting']);
    expect(manifest.host_permissions).toEqual(['https://api.sendpulse.com/*', 'https://mail.google.com/']);
  });

  it('exposes only icons and the settings page to Gmail', () => {
    expect(manifest.web_accessible_resources).toEqual([
      { resources: ['icons/*', 'src/options/index.html'], matches: ['https://mail.google.com/*'] },
    ]);
  });

  it('injects the content script only into Gmail', () => {
    const matches = manifest.content_scripts.flatMap((cs) => cs.matches);
    expect(matches).toEqual(['https://mail.google.com/*']);
  });
});

describe('Firefox manifest', () => {
  it('runs the same background module as an event page', () => {
    expect(firefoxManifest.background).toEqual({ scripts: ['src/background/index.ts'], type: 'module' });
  });

  it('opens settings in a tab via options_ui', () => {
    expect(firefoxManifest).not.toHaveProperty('options_page');
    expect(firefoxManifest.options_ui).toEqual({ page: 'src/options/index.html', open_in_tab: true });
  });

  it('keeps permissions, content scripts and web resources identical to Chrome', () => {
    for (const key of [
      'permissions',
      'host_permissions',
      'content_scripts',
      'web_accessible_resources',
    ] as const) {
      expect(firefoxManifest[key]).toEqual(manifest[key]);
    }
  });

  // The add-on ID is permanent once published on AMO.
  it('has a fixed gecko ID and a minimum version with MAIN-world scripting', () => {
    const { gecko } = firefoxManifest.browser_specific_settings;
    expect(gecko.id).toBe('sendpulse-gmail@roybush.github.io');
    expect(Number.parseInt(gecko.strict_min_version)).toBeGreaterThanOrEqual(140);
  });

  it('declares the data it sends to SendPulse', () => {
    expect(firefoxManifest.browser_specific_settings.gecko.data_collection_permissions.required).toEqual([
      'personallyIdentifyingInfo',
      'authenticationInfo',
    ]);
  });
});
