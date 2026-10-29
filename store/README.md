# Chrome Web Store: оновлення до 2.0

Firefox Add-ons (AMO) — див. [AMO.md](AMO.md).

Існуючий запис: **SendPulse Gmail Extension** (`mpcnoobdnjnpajojombadpfjjcajbgcn`), видавець `roybush`.

## Що де лежить

| Файл                                                | Куди в Developer Dashboard                             |
| --------------------------------------------------- | ------------------------------------------------------ |
| `../sendpulse-gmail.zip` (`npm run zip`)            | Пакунок → Завантажити новий пакунок                    |
| `listing-en.md`                                     | Сторінка продукту → Опис (English), категорія          |
| `listing-<мова>.md` (uk, es, de, pt_BR, pl, tr, fr) | Сторінка продукту → додати мову → Опис                 |
| `images/promo-small-440x280.png`                    | Сторінка продукту → Маленька рекламна плитка           |
| `images/promo-marquee-1400x560.png`                 | Сторінка продукту → Рекламна плитка Marquee            |
| `images/<мова>/screenshot-*.png` (1280×800)         | Знімки екрана для відповідної мови (у порядку номерів) |
| `privacy-practices.md`                              | Конфіденційність; Вказівки щодо тестування             |
| `../PRIVACY.md`                                     | URL політики конфіденційності (після злиття в master)  |

## Порядок дій

1. Злити гілки в `master` (щоб посилання на `PRIVACY.md` працювало).
2. `npm run zip` — перевірити, що в `.env` є `VITE_INBOXSDK_APP_ID`.
3. Пакунок: завантажити `sendpulse-gmail.zip` (версія 2.0.0 > 0.5).
4. Сторінка продукту: опис, категорія, плитки, скриншоти; старі скриншоти видалити. Для кожної
   мови (uk, es, de, pt_BR, pl, tr, fr) додати переклад: опис з `listing-<мова>.md` і скриншоти з
   `images/<мова>/`. Назва й підсумок підставляться з пакета автоматично.
5. Конфіденційність: єдина мета, обґрунтування дозволів, «без віддаленого коду», використання
   даних, три сертифікації, URL політики.
6. Вказівки щодо тестування: текст з `privacy-practices.md`.
7. Зберегти чернетку → Надіслати на розгляд.

## Перегенерувати картинки

```sh
npx vite --config store/src/vite.config.mjs &   # сцени на :5299
PLAYWRIGHT=/path/to/node_modules/playwright/index.mjs node store/src/render.mjs
```

Дані на скриншотах вигадані; компоненти панелі й налаштувань — справжні з `src/`. Щоб перегенерувати
лише деякі мови: `LANGS=uk,de node store/src/render.mjs`.

## Інші магазини

- Microsoft Edge Add-ons: [`EDGE.md`](EDGE.md) — той самий пакет.
- Firefox (AMO): у гілці `roybush/firefox`.
