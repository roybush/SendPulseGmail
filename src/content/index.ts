import { call } from '../shared/messages';

// Gmail integration (GmailAdapter on InboxSDK) lands in stage 3.
// For now just verify the content script ↔ service worker wiring.
call('app.version').then((version) => {
  console.info(`[SendPulse] extension v${version} loaded`);
});
