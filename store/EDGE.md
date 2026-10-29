# Microsoft Edge Add-ons

Edge — це Chromium, тож пакет той самий, що й для Chrome: `sendpulse-gmail.zip` (`npm run zip`).
Manifest V3, InboxSDK і `optional_host_permissions` працюють без змін.

## Акаунт

1. Partner Center: https://partner.microsoft.com/dashboard/microsoftedge/overview
2. Реєстрація розробника Edge безкоштовна (особистий акаунт Microsoft).

## Новий продукт

1. **Create new extension** → завантажити `sendpulse-gmail.zip`.
2. **Availability**: Public, усі ринки.
3. **Properties**:
   - Category: _Productivity_.
   - Privacy policy URL: https://github.com/roybush/SendPulseGmail/blob/master/PRIVACY.md
   - Website: https://github.com/roybush/SendPulseGmail
   - Support contact: https://github.com/roybush/SendPulseGmail/issues
   - Mature content: No.
4. **Store listings** — для кожної мови (en, uk, es, de, pt-BR, pl, tr, fr):
   - Description: розділ «Description» з `listing-<мова>.md`
     (`sh store/copy-description.sh <мова>` копіює його в буфер).
   - Short description: підставляється з пакета (`extDescription`).
   - Screenshots: `images/<мова>/screenshot-*.png` (1280×800 підходить).
   - Small promotional tile 440×280: `images/promo-small-440x280.png`.
   - Large promotional tile 1400×560: `images/promo-marquee-1400x560.png`.
   - Logo 300×300: Edge просить квадратний логотип; можна збільшити `public/icons/icon-128.png`
     або намалювати окремо.
5. **Notes for certification**: текст із розділу «Test instructions» у `privacy-practices.md`.
6. **Publish**. Перевірка зазвичай триває до 7 робочих днів.

## Відмінності від Chrome Web Store

- Окремої анкети «Privacy practices» немає — достатньо URL політики конфіденційності, але в описі
  має бути чесно вказано, які дані йдуть куди (наш опис і `PRIVACY.md` це вже покривають).
- Edge показує попередження про права під час встановлення так само, як Chrome:
  `mail.google.com` і `api.sendpulse.com`. Hunter/Apollo — лише коли користувач їх увімкне.
- Оновлення: нова версія в `package.json` → `npm run zip` → **Update** у Partner Center.
