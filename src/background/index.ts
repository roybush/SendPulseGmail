// Injects InboxSDK's page-world script into Gmail on request from the content script.
import '@inboxsdk/core/background.js';
import { createRouter, isRpcRequest } from './router';
import { SendPulseClient } from './sendpulse';
import { chromeStore } from './storage';

// Credentials survive browser restarts; the access token lives only for the session.
const client = new SendPulseClient(chromeStore(chrome.storage.local), chromeStore(chrome.storage.session));
const route = createRouter(client, {
  version: chrome.runtime.getManifest().version,
  openOptions: () => chrome.runtime.openOptionsPage(),
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Only our own extension pages and content scripts may talk to the API.
  if (sender.id !== chrome.runtime.id || !isRpcRequest(request)) return false;
  route(request).then(sendResponse);
  return true; // keep the channel open for the async response
});

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: 'https://mail.google.com/' });
});
