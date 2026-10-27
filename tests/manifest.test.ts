import { describe, expect, it } from 'vitest';
import { manifest } from '../src/manifest';

describe('manifest', () => {
  it('is Manifest V3', () => {
    expect(manifest.manifest_version).toBe(3);
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
