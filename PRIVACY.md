# Privacy Policy — SendPulse Gmail Extension

_Last updated: October 29, 2026_

SendPulse Gmail Extension ("the extension") is a browser extension for Chrome and Firefox that helps
you add people from your Gmail conversations to your SendPulse account (mailing lists and CRM). This
policy explains what data the extension handles and where it goes.

## Summary

- The extension has no servers of its own. It does not sell, share or use your data for advertising.
- Data goes to the official SendPulse API (`api.sendpulse.com`) under **your** SendPulse account.
- The Gmail integration library (InboxSDK) may send technical error reports to its developer, Streak.

## What the extension reads

**Your SendPulse credentials.** The API key, or client ID and secret, you enter in the extension's
settings. They are stored in the browser's extension storage (`chrome.storage.local`) on your device
and used only to authenticate requests to the SendPulse API. A temporary access token is kept in
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
  they are already in and, for people already in SendPulse, their campaign statistics (sent, opened,
  clicked) and blacklist status;
- when you click **Add** — the email addresses, names and contact details you chose to save, to the
  mailing list you selected. With **Ask for confirmation** on, SendPulse first emails each new contact
  a confirmation link from the sender address you chose;
- when you use **Actions** — the contact's email address, to unsubscribe it from the selected list,
  add it to or remove it from your blacklist, look it up in and add it to SendPulse CRM (with the
  name and phone shown in the panel), or check which of your SendPulse chatbots it is subscribed to;
- when you click **Save email to CRM** — the email's subject, a link to it in Gmail and the text of
  the latest message (up to 1,500 characters), as a comment on the CRM contact;
- when you click **Create task** — a reminder task with the person's name, the email's subject and
  link, linked to the CRM contact;
- when you click **Start flow** — the person's email and the details shown in the panel (phone,
  name, company, job title, website, LinkedIn), as an Automation 360 event you named;
- when you click **Create deal** — the deal name, pipeline and stage you chose, and the checked
  contacts (email, name, phone), to SendPulse CRM;
- your credentials, to obtain an access token, and requests to list your mailing lists, their
  variables and your CRM pipelines.

How SendPulse processes this data is governed by
[SendPulse's privacy policy](https://sendpulse.com/legal/pp) and your agreement with SendPulse.

**To InboxSDK / Streak (`api.inboxsdk.com`).** The extension uses
[InboxSDK](https://www.inboxsdk.com/) to integrate with Gmail. Usage analytics in InboxSDK are
turned off. InboxSDK may still report its own internal errors, which include a technical stack trace,
a one-way hash of your Gmail address, the extension's ID and the page address
(`https://mail.google.com`). They are meant for debugging InboxSDK, not for collecting email
content, and never include your SendPulse credentials. See [Streak's privacy policy](https://www.streak.com/privacy).

**Hunter or Apollo (optional, off by default).** If you add your own Hunter (`api.hunter.io`) or
Apollo (`api.apollo.io`) API key in the settings, Chrome asks you to allow access to that service.
Then, only when you click **Fill in from Hunter/Apollo** for a person, their email address is sent to
that service under your account, and the details it returns are filled into empty fields in the
panel. How the service processes the address is governed by its own terms and privacy policy. The key
is stored in `chrome.storage.local` like your SendPulse key; **Remove** deletes it and the access.

**LinkedIn.** The **Find** button opens LinkedIn's public people search in a new tab with the
contact's name and company in the address. The extension never loads or reads LinkedIn pages itself.

Nothing else is sent anywhere. The extension contains no analytics, advertising or tracking code of
its own.

## Data stored on your device

| What                                    | Where                    | Removed when                             |
| --------------------------------------- | ------------------------ | ---------------------------------------- |
| SendPulse API key or client ID + secret | `chrome.storage.local`   | you click Disconnect or remove extension |
| Access token (1 hour)                   | `chrome.storage.session` | browser closes or you click Disconnect   |
| Last selected list and pipeline, fields | `chrome.storage.local`   | you remove the extension                 |
| Hunter / Apollo API key (if added)      | `chrome.storage.local`   | you click Remove or remove the extension |

## Limited use

The extension uses the data above only to provide its single purpose — adding people from Gmail
conversations to your SendPulse mailing lists. It does not transfer data to third parties except as
described above, does not use it for advertising, and does not use it to determine
creditworthiness or for lending purposes.

## Contact

Questions or requests: open an issue at
[github.com/roybush/SendPulseGmail](https://github.com/roybush/SendPulseGmail/issues).
