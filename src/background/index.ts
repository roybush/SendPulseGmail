import { createRouter } from './router';
import { SendPulseClient } from './sendpulse';
import { chromeStore } from './storage';

// Credentials survive browser restarts; the access token lives only for the session.
const client = new SendPulseClient(chromeStore(chrome.storage.local), chromeStore(chrome.storage.session));
const route = createRouter(client, chrome.runtime.getManifest().version);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Only our own extension pages and content scripts may talk to the API.
  if (sender.id !== chrome.runtime.id) return false;
  route(request).then(sendResponse);
  return true; // keep the channel open for the async response
});

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: 'https://mail.google.com/' });
});
