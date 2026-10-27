# Privacy Policy — SendPulse Gmail Extension

_Last updated: October 27, 2026_

SendPulse Gmail Extension ("the extension") is a Chrome extension that helps you add people from your
Gmail conversations to your SendPulse mailing lists. This policy explains what data the extension
handles and where it goes.

## Summary

- The extension has no servers of its own. It does not sell, share or use your data for advertising.
- Data goes to the official SendPulse API (`api.sendpulse.com`) under **your** SendPulse account.
- The Gmail integration library (InboxSDK) may send technical error reports to its developer, Streak.

## What the extension reads

**Your SendPulse credentials.** The API key, or client ID and secret, you enter in the extension's
settings. They are stored in Chrome's extension storage (`chrome.storage.local`) on your device and
used only to authenticate requests to the SendPulse API. A temporary access token is kept in
`chrome.storage.session` and is cleared when the browser closes. Credentials are never placed on the
Gmail page itself. You can remove them at any time with **Disconnect**.

**The email you have open in Gmail.** When you open a conversation, the extension reads, locally in
your browser:

- names and email addresses of the participants (sender, recipients, CC);
- the text and links of each sender's message, to find their signature (name, phone, company, job
  title, website, LinkedIn profile URL). Quoted earlier messages are ignored.

The extension does not read other emails, your contact list, or anything outside Gmail.

## What is sent, and where

**To SendPulse (`api.sendpulse.com`), under your account:**

- when you open an email — the participants' email addresses, to check which of your mailing lists
  they are already in;
- when you click **Add** — the email addresses, names and contact details you chose to save, to the
  mailing list you selected;
- your credentials, to obtain an access token, and requests to list your mailing lists and their
  variables.

How SendPulse processes this data is governed by
[SendPulse's privacy policy](https://sendpulse.com/legal/pp) and your agreement with SendPulse.

**To InboxSDK / Streak (`api.inboxsdk.com`).** The extension uses
[InboxSDK](https://www.inboxsdk.com/) to integrate with Gmail. Usage analytics in InboxSDK are
turned off. InboxSDK may still report its own internal errors, which include a technical stack trace,
a one-way hash of your Gmail address, the extension's ID and the page address
(`https://mail.google.com`). They are meant for debugging InboxSDK, not for collecting email
content, and never include your SendPulse credentials. See [Streak's privacy policy](https://www.streak.com/privacy).

**LinkedIn.** The **Find** button opens LinkedIn's public people search in a new tab with the
contact's name and company in the address. The extension never loads or reads LinkedIn pages itself.

Nothing else is sent anywhere. The extension contains no analytics, advertising or tracking code of
its own.

## Data stored on your device

| What                                    | Where                    | Removed when                             |
| --------------------------------------- | ------------------------ | ---------------------------------------- |
| SendPulse API key or client ID + secret | `chrome.storage.local`   | you click Disconnect or remove extension |
| Access token (1 hour)                   | `chrome.storage.session` | browser closes or you click Disconnect   |
| Last selected mailing list, field setup | `chrome.storage.local`   | you remove the extension                 |

## Limited use

The extension uses the data above only to provide its single purpose — adding people from Gmail
conversations to your SendPulse mailing lists. It does not transfer data to third parties except as
described above, does not use it for advertising, and does not use it to determine
creditworthiness or for lending purposes.

## Contact

Questions or requests: open an issue at
[github.com/roybush/SendPulseGmail](https://github.com/roybush/SendPulseGmail/issues).
