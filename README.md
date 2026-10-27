# SendPulse for Gmail

Chrome extension (Manifest V3) that lets you add people from your Gmail conversations to
[SendPulse](https://sendpulse.com/) address books via the SendPulse REST API.

> v2 is a rewrite in progress — see [ROADMAP.md](ROADMAP.md) for stages and status.

## Stack

Vue 3 · TypeScript · Vite + [CRXJS](https://crxjs.dev/) · Vitest · ESLint + Prettier

## Develop

Requires Node ≥ 22 (see `.nvmrc`).

```sh
npm install
npm run dev
```

Then open `chrome://extensions`, enable **Developer mode**, click **Load unpacked** and select
the `dist` directory. With `npm run dev` running, changes reload automatically.

Before the first run, copy `.env.example` to `.env` and set your InboxSDK app ID
(free at [inboxsdk.com/register](https://www.inboxsdk.com/register)); InboxSDK won't load without it.

## Scripts

| Command             | What it does                                     |
| ------------------- | ------------------------------------------------ |
| `npm run dev`       | dev build with hot reload into `dist/`           |
| `npm run build`     | type-check and production build into `dist/`     |
| `npm run zip`       | production build packed as `sendpulse-gmail.zip` |
| `npm test`          | unit tests                                       |
| `npm run lint`      | ESLint                                           |
| `npm run typecheck` | `vue-tsc` type check                             |
| `npm run format`    | Prettier                                         |

## Layout

```
src/
  manifest.ts      MV3 manifest (permissions are covered by tests/manifest.test.ts)
  background/      service worker: all network calls to SendPulse, token storage
  content/         Gmail sidebar panel; gmail.ts is the only file that talks to InboxSDK
  options/         options page (Vue)
  shared/          typed messages between the parts above
```

## Publish

Bump `version` in `package.json`, run `npm run zip` and upload `sendpulse-gmail.zip` in the
[Chrome Web Store developer dashboard](https://chrome.google.com/webstore/devconsole).
