/**
 * The only place that knows about Gmail's UI. Everything Gmail-specific goes through
 * InboxSDK here, so when Gmail changes we update the SDK (or this file) and nothing else.
 */
import * as InboxSDK from '@inboxsdk/core';
import type { MessageView } from '@inboxsdk/core';
import { patchInboxSdkForFirefox } from './firefox';
import { messageSignatureSource } from './message-text';
import { collectParticipants, type MessageHeaders, type Participant } from './participants';

// Register for free at https://register.inboxsdk.com and put the ID into .env.
// InboxSDK refuses to load with an unregistered ID, even in development.
const APP_ID = import.meta.env.VITE_INBOXSDK_APP_ID;

export type OpenThread = {
  subject: string;
  /** Link to the thread and the latest message's own text. */
  url: string;
  text: string;
  participants: Participant[];
  /** Puts `el` into Gmail's right sidebar for this thread. */
  showPanel(el: HTMLElement): void;
  onClose(callback: () => void): void;
};

/** People from the threads checked in a Gmail list (inbox, search, label). */
export type BulkSelection = {
  participants: Participant[];
  /** Gmail label being viewed, if any. */
  label?: string;
  /** Opens `el` in a drawer over Gmail; `onClose` runs when the user closes it. */
  showDrawer(el: HTMLElement, title: string, onClose: () => void): void;
};

export type GmailHandlers = {
  onThreadOpen(thread: OpenThread): void;
  onBulkSelect(selection: BulkSelection): void;
  /** Toolbar button title above a list with checked threads. */
  bulkButtonTitle: string;
};

export async function connectGmail(handlers: GmailHandlers): Promise<void> {
  if (!APP_ID) throw new Error('VITE_INBOXSDK_APP_ID is not set; see .env.example');
  patchInboxSdkForFirefox();
  const sdk = await InboxSDK.load(2, APP_ID, {
    appName: 'SendPulse',
    // No usage analytics, and don't hook Gmail's own errors. InboxSDK still reports its own
    // internal errors to api.inboxsdk.com (stack trace + hashed account email); see PRIVACY.md.
    eventTracking: false,
    globalErrorLogging: false,
  });
  const selfEmail = sdk.User.getEmailAddress();

  sdk.Conversations.registerThreadViewHandler(async (threadView) => {
    const headers = await Promise.all(
      threadView
        .getMessageViewsAll()
        .filter((m) => m.isLoaded())
        .map(readHeaders),
    );
    const threadId = await threadView.getThreadIDAsync().catch(() => '');
    if (threadView.destroyed) return;

    handlers.onThreadOpen({
      subject: threadView.getSubject(),
      // Keep the account part (/mail/u/1/) so the link opens in the right mailbox.
      url: threadId ? `${location.origin}${location.pathname}#all/${threadId}` : location.href,
      text: headers.at(-1)?.signature?.text.trim() ?? '',
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

  // Only the senders shown in each row: reading every message of many threads would be slow.
  sdk.Toolbars.registerThreadButton({
    title: handlers.bulkButtonTitle,
    iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
    positions: ['LIST'],
    onClick({ selectedThreadRowViews }) {
      const headers = selectedThreadRowViews.flatMap((row) =>
        row.getContacts().map((sender) => ({ sender, recipients: [] })),
      );
      handlers.onBulkSelect({
        participants: collectParticipants(headers, selfEmail),
        label: currentLabel(sdk),
        showDrawer(el, title, onClose) {
          sdk.Widgets.showDrawerView({ el, title }).on('destroy', onClose);
        },
      });
    },
  });
}

/** "label/Clients+2026/p2" -> "Clients 2026". */
function currentLabel(sdk: InboxSDK.InboxSDK): string | undefined {
  const route = sdk.Router.getCurrentRouteView();
  if (route.getRouteID() !== sdk.Router.NativeListRouteIDs.LABEL) return undefined;
  const name = route.getParams().labelName;
  return name ? decodeURIComponent(name.replace(/\+/g, ' ')) : undefined;
}

async function readHeaders(message: MessageView): Promise<MessageHeaders> {
  return {
    sender: message.getSender(),
    recipients: await message.getRecipientsFull(),
    signature: messageSignatureSource(message.getBodyElement()),
  };
}
