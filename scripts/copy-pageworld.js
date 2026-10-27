// InboxSDK's background script injects `pageWorld.js` from the extension root into Gmail,
// so it must be shipped as a plain file rather than bundled.
import { copyFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
copyFileSync(
  require.resolve('@inboxsdk/core/pageWorld.js'),
  new URL('../public/pageWorld.js', import.meta.url),
);
