# Вкладка «Конфіденційність» у Developer Dashboard

Готові відповіді, щоб скопіювати у відповідні поля.

## Single purpose (Єдина мета)

Add people from the Gmail conversation you are viewing to your SendPulse mailing lists: shows the
participants, their status in SendPulse and contact details from their signatures, and adds the
ones you select to a mailing list via the SendPulse API.

## Permission justifications (Обґрунтування дозволів)

**storage**
Stores the user's SendPulse API key (or client ID and secret), a temporary access token, the last
selected mailing list and the per-list field mapping, so the user doesn't have to sign in or set up
fields again.

**scripting**
Required by InboxSDK, the library used to add the panel to Gmail's sidebar: the extension's service
worker injects InboxSDK's bundled page script (pageWorld.js, shipped inside the package) into the
Gmail tab. No remote code is executed.

**Host permission: https://api.sendpulse.com/\***
All calls to the official SendPulse REST API (authentication, mailing lists, contact lookup and statistics, adding
contacts, unsubscribe and blacklist, CRM contacts and deals) are made from the extension's service worker.

**Host permission: https://mail.google.com/**
Needed to show the SendPulse panel in Gmail and to inject InboxSDK's page script into the Gmail tab
(together with the scripting permission).

## Remote code (Віддалений код)

**No, I am not using remote code.** All JavaScript, including InboxSDK, is bundled in the package.

## Data usage (Використання даних)

Collected / handled:

- [x] **Personally identifiable information** — names and email addresses of email participants;
      phone, company and job title from signatures.
- [x] **Authentication information** — the user's SendPulse API key or client ID/secret.
- [x] **Personal communications** — the open email is read locally to find participants and
      signatures.
- [x] **Website content** — text and links of the open email (same as above).
- [ ] Health information
- [ ] Financial and payment information
- [ ] Location
- [ ] Web history
- [ ] User activity

Certifications (тицнути всі три):

- [x] I do not sell or transfer user data to third parties, outside of the approved use cases.
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes.

## Privacy policy URL

https://github.com/roybush/SendPulseGmail/blob/master/PRIVACY.md

(Посилання запрацює після злиття гілки з `PRIVACY.md` у `master`.)

## Test instructions (Вказівки щодо тестування)

The extension needs a SendPulse account. A free SendPulse account works.

1. Sign up at https://sendpulse.com (free plan), then create a mailing list (Email → Mailing lists →
   Create).
2. In SendPulse go to Settings → API → API keys → Create key, and copy the key.
3. Install the extension, open https://mail.google.com and open any email that has at least one
   other participant.
4. Click the SendPulse icon in Gmail's right sidebar, paste the API key and click Connect.
5. The panel lists the participants. Select one, choose the mailing list and click
   "Add 1 to SendPulse". The status changes to "In: <list name>".
6. Clicking the extension's toolbar icon opens the same settings in a popup.

Якщо захочете дати рецензентам готовий тестовий акаунт — замініть кроки 1–2 на логін і ключ
окремого тестового акаунта SendPulse (не основного).
