# Firefox Add-ons (AMO): перша публікація

Новий запис на [addons.mozilla.org/developers](https://addons.mozilla.org/developers/). ID доповнення
`sendpulse-gmail@roybush.github.io` (з `src/manifest.ts`) після першого завантаження змінити не можна.

## Що де лежить

| Файл                                                     | Куди на AMO                                            |
| -------------------------------------------------------- | ------------------------------------------------------ |
| `../sendpulse-gmail-firefox.zip` (`npm run zip:firefox`) | Submit a New Add-on → Upload                           |
| `../sendpulse-gmail-source.zip` (див. нижче)             | «Do you need to submit source code?» → Yes → Upload    |
| `listing-en.md` → Description                            | Describe Add-on → Description (English)                |
| `listing-<мова>.md` (uk, es, de, pt_BR, pl, tr, fr)      | Edit Product Page → змінити мову зверху → Description  |
| `images/<мова>/screenshot-*.png` (1280×800)              | Edit Product Page → Screenshots (спільні для всіх мов) |
| `../PRIVACY.md`                                          | Edit Product Page → Privacy Policy (вставити текст)    |
| розділ «Notes to Reviewer» нижче                         | Upload New Version / Submit → Notes to Reviewer        |

Назва й короткий опис (summary) беруться з пакета (`_locales/*/messages.json`) для всіх 8 мов.
Рекламних плиток на AMO немає.

## Порядок дій

1. Злити гілку з Firefox у `master` і перевірити, що Chrome-збірка працює як раніше.
2. Зібрати пакети (у `.env` має бути `VITE_INBOXSDK_APP_ID`):

   ```sh
   npm run zip:firefox                                # sendpulse-gmail-firefox.zip
   git archive -o sendpulse-gmail-source.zip HEAD     # вихідний код для рецензента
   ```

3. Submit a New Add-on → **On this site** (публічний лістинг) → завантажити
   `sendpulse-gmail-firefox.zip`. Платформи: лише **Firefox** (не Android — у мобільному Gmail
   немає бічної панелі).
4. Source code: **Yes**, завантажити `sendpulse-gmail-source.zip`.
5. Describe Add-on:
   - **Description** — з `listing-en.md`, але рядок «Completely rebuilt for the latest Chrome
     (Manifest V3)» замінити на «Completely rebuilt (Manifest V3)»; те саме в перекладах.
   - **Categories** — Social & Communication (AMO не має категорії Productivity).
   - **Support email / website** — `https://github.com/roybush/SendPulseGmail/issues`.
   - **License** — MIT License (файл `LICENSE` у репозиторії).
   - **Privacy Policy** — потрібна, бо доповнення передає дані: вставити текст `PRIVACY.md`.
6. Notes to Reviewer — текст нижче.
7. Після відправки: Edit Product Page → додати переклади описів і скриншоти.

## Збирання даних

Задеклароване в маніфесті (`data_collection_permissions.required`), Firefox показує це при
встановленні:

- `personallyIdentifyingInfo` — імена, адреси й дані з підписів учасників листа йдуть у SendPulse;
- `authenticationInfo` — API-ключ користувача йде в SendPulse для отримання токена.

Не задекларовано: звіти про внутрішні помилки InboxSDK (`api.inboxsdk.com`). Firefox дозволяє
`technicalAndInteraction` лише як опціональну категорію, яку користувач може вимкнути, а InboxSDK
не дає їх вимкнути. Вони описані в `PRIVACY.md`; якщо рецензент спитає — відповісти так само.

## Notes to Reviewer

```
BUILD
The package is built from TypeScript/Vue with Vite. Source code is attached.
Requirements: Node.js 22+ (see .nvmrc), npm, macOS/Linux.

  npm ci
  echo "VITE_INBOXSDK_APP_ID=<value>" > .env
  npm run build:firefox      # output in dist-firefox/

VITE_INBOXSDK_APP_ID is a public InboxSDK app ID that is embedded in the shipped code; you can
copy it from the built content script (search for "sdk_"), or use any ID registered at
https://register.inboxsdk.com — the build output is otherwise identical.

THIRD-PARTY CODE
- InboxSDK (@inboxsdk/core, npm, by Streak) adds the panel to Gmail's sidebar. pageWorld.js is
  copied unmodified from node_modules/@inboxsdk/core/pageWorld.js and injected into the Gmail tab
  via scripting.executeScript (world: MAIN). No remote code is loaded.
- Vue 3 for the UI.
Linter warnings about innerHTML / Function come from these libraries.

FIREFOX COMPATIBILITY SHIM
InboxSDK is written for Chrome's content-script model. src/content/firefox.ts (runs only when
cloneInto exists) does two things in the content script before InboxSDK starts:
1. sets window.chrome = chrome as a content-script expando (not visible to the page), because
   InboxSDK calls window.chrome.runtime.sendMessage to request pageWorld injection;
2. wraps CustomEvent so that event `detail` objects are cloned into the page with cloneInto,
   because InboxSDK passes data to its page script in CustomEvent details. Only JSON-like data is
   passed; no extension APIs or functions are exposed to the page.

DATA
Data goes only to the official SendPulse API (api.sendpulse.com) under the user's own account,
plus InboxSDK's own error reports to api.inboxsdk.com (no email content, no credentials). Usage
analytics in InboxSDK are disabled. Privacy policy:
https://github.com/roybush/SendPulseGmail/blob/master/PRIVACY.md

HOW TO TEST
The extension needs a SendPulse account (the free plan works).
1. Sign up at https://sendpulse.com, create a mailing list (Email → Mailing lists → Create).
2. In SendPulse go to Settings → API → API keys → Create key, and copy the key.
3. Install the add-on, open https://mail.google.com and open any email that has at least one
   other participant.
4. Click the SendPulse icon in Gmail's right sidebar, paste the API key and click Connect.
5. The panel lists the participants. Select one, choose the mailing list and click
   "Add 1 to SendPulse". The status changes to "In: <list name>".
6. The add-on's toolbar button opens the same settings in a popup.
```

Якщо захочете дати рецензентам готовий тестовий акаунт — замініть кроки 1–2 на логін і ключ
окремого тестового акаунта SendPulse (не основного).
