/**
 * The only place that knows about Gmail's UI. Everything Gmail-specific goes through
 * InboxSDK here, so when Gmail changes we update the SDK (or this file) and nothing else.
 */
import * as InboxSDK from '@inboxsdk/core';
import type { MessageView } from '@inboxsdk/core';
import { collectParticipants, type MessageHeaders, type Participant } from './participants';

// Any string works in development; a registered ID (inboxsdk.com/register) is needed for release.
const APP_ID = import.meta.env.VITE_INBOXSDK_APP_ID || 'sendpulse-gmail-dev';

export type OpenThread = {
  subject: string;
  participants: Participant[];
  /** Puts `el` into Gmail's right sidebar for this thread. */
  showPanel(el: HTMLElement): void;
  onClose(callback: () => void): void;
};

export async function onThreadOpen(handler: (thread: OpenThread) => void): Promise<void> {
  const sdk = await InboxSDK.load(2, APP_ID, { appName: 'SendPulse' });
  const selfEmail = sdk.User.getEmailAddress();

  sdk.Conversations.registerThreadViewHandler(async (threadView) => {
    const headers = await Promise.all(
      threadView
        .getMessageViewsAll()
        .filter((m) => m.isLoaded())
        .map(readHeaders),
    );
    if (threadView.destroyed) return;

    handler({
      subject: threadView.getSubject(),
      participants: collectParticipants(headers, selfEmail),
      showPanel(el) {
        threadView.addSidebarContentPanel({
          el,
          id: 'sendpulse',
          title: 'SendPulse',
          iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
        });
      },
      onClose(callback) {
        threadView.on('destroy', callback);
      },
    });
  });
}

async function readHeaders(message: MessageView): Promise<MessageHeaders> {
  return { sender: message.getSender(), recipients: await message.getRecipientsFull() };
}
