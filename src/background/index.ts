import type { Request, ResponseFor } from '../shared/messages';

async function handle(request: Request): Promise<ResponseFor<Request>> {
  switch (request.type) {
    case 'ping':
      return { ok: true, version: chrome.runtime.getManifest().version };
  }
}

chrome.runtime.onMessage.addListener((request: Request, _sender, sendResponse) => {
  handle(request).then(sendResponse);
  return true; // keep the channel open for the async response
});

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: 'https://mail.google.com/' });
});
