import { send } from '../shared/messages';

// Gmail integration (GmailAdapter on InboxSDK) lands in stage 3.
// For now just verify the content script ↔ service worker wiring.
send({ type: 'ping' }).then((res) => {
  console.info(`[SendPulse] extension v${res.version} loaded`);
});
