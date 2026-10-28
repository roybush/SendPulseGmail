// Renders Chrome Web Store images into store/images.
//
//   npx vite --config store/src/vite.config.mjs &     # serves the screenshot scenes on :5299
//   PLAYWRIGHT=/path/to/node_modules/playwright node store/src/render.mjs
//
// Playwright isn't a project dependency; install it anywhere (`npm i playwright && npx playwright
// install chromium`) and point PLAYWRIGHT at it. Output is PNG; the store wants no alpha channel,
// so convert with `sips -s format jpeg` (macOS) or any image tool if it complains.
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const out = (name) => fileURLToPath(new URL(`../images/${name}`, import.meta.url));
const tile = (name) => new URL(`./tiles/${name}`, import.meta.url).href;
const SERVER = 'http://localhost:5299/screens/';

const SCENES = ['contacts', 'details', 'fields', 'connect'];
const FILES = {
  contacts: 'screenshot-1-contacts.png',
  details: 'screenshot-2-details.png',
  fields: 'screenshot-3-fields.png',
  connect: 'screenshot-4-connect.png',
};
const CAPTIONS = {
  en: [
    'Everyone in the conversation, with their SendPulse status',
    'Contact details picked up from the email signature',
    'Choose once where each field goes in your mailing list',
    'Connect with a SendPulse API key in seconds',
  ],
  uk: [
    'Усі учасники листування та їхній статус у SendPulse',
    'Контакти, знайдені в підписі листа',
    'Один раз обираєте, куди йде кожне поле',
    'Підключення за API-ключем SendPulse за секунди',
  ],
  es: [
    'Todos los participantes, con su estado en SendPulse',
    'Datos de contacto extraídos de la firma',
    'Elige una vez dónde va cada campo de tu lista',
    'Conéctate con una clave API de SendPulse en segundos',
  ],
  de: [
    'Alle Beteiligten mit ihrem SendPulse-Status',
    'Kontaktdaten direkt aus der E-Mail-Signatur',
    'Einmal festlegen, wohin jedes Feld gehört',
    'In Sekunden mit einem SendPulse-API-Schlüssel verbinden',
  ],
  pt_BR: [
    'Todos da conversa, com o status no SendPulse',
    'Dados de contato tirados da assinatura',
    'Escolha uma vez onde cada campo vai na sua lista',
    'Conecte com uma chave de API do SendPulse em segundos',
  ],
  pl: [
    'Wszyscy uczestnicy rozmowy i ich status w SendPulse',
    'Dane kontaktowe pobrane z podpisu',
    'Raz wybierasz, gdzie trafia każde pole',
    'Połącz się kluczem API SendPulse w kilka sekund',
  ],
  tr: [
    'Yazışmadaki herkes ve SendPulse durumları',
    'İmzadan alınan iletişim bilgileri',
    'Her alanın listede nereye gideceğini bir kez seçin',
    'SendPulse API anahtarıyla saniyeler içinde bağlanın',
  ],
  fr: [
    'Tous les participants, avec leur statut SendPulse',
    'Coordonnées récupérées dans la signature',
    'Choisissez une fois où va chaque champ de votre liste',
    'Connectez-vous avec une clé API SendPulse en quelques secondes',
  ],
};
const LANGS = process.env.LANGS ? process.env.LANGS.split(',') : Object.keys(CAPTIONS);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

for (const lang of LANGS) {
  mkdirSync(out(`${lang}/`), { recursive: true });
  for (const [i, scene] of SCENES.entries()) {
    const name = `${lang}/${FILES[scene]}`;
    const caption = CAPTIONS[lang][i];
    await page.goto(`${SERVER}?scene=${scene}&lang=${lang}`);
    await page.evaluate(
      ([s, c]) => {
        document.body.classList.add(`scene-${s}`);
        document.getElementById('caption').textContent = c;
      },
      [scene, caption],
    );
    if (scene === 'connect') {
      await page.waitForSelector('#popup form');
    } else {
      await page.waitForFunction(
        // Loading states end with "…" in every language.
        () => {
          const statuses = [...document.querySelectorAll('.sp-status')];
          return statuses.length && statuses.every((el) => !el.textContent.trim().endsWith('…'));
        },
      );
    }
    if (scene === 'details') {
      await page.locator('li', { hasText: 'bob@stonelabs.io' }).locator('.sp-toggle').click();
    }
    if (scene === 'fields') {
      await page.locator('li', { hasText: 'bob@stonelabs.io' }).locator('input[type=checkbox]').uncheck();
      await page.locator('li', { hasText: 'maria.garcia' }).locator('input[type=checkbox]').uncheck();
      await page.locator('.sp-add .sp-toggle').click();
    }
    await page.mouse.move(0, 0);
    await page.waitForTimeout(300);
    await page.screenshot({ path: out(name) });
    console.log('wrote', name);

    if (scene === 'details' && lang === 'en') {
      // The marquee shows this panel on its own.
      const side = await page.locator('.side').boundingBox();
      await page.screenshot({
        path: fileURLToPath(new URL('./tiles/panel.png', import.meta.url)),
        clip: { x: side.x, y: side.y, width: side.width, height: Math.min(side.height, 560) },
        scale: 'device',
      });
    }
  }
}

// Promo tiles are English only.
for (const [file, width, height, name] of [
  ['small.html', 440, 280, 'promo-small-440x280.png'],
  ['marquee.html', 1400, 560, 'promo-marquee-1400x560.png'],
]) {
  await page.setViewportSize({ width, height });
  await page.goto(tile(file));
  await page.waitForTimeout(200);
  await page.screenshot({ path: out(name) });
  console.log('wrote', name);
}

await browser.close();
if (errors.length) {
  console.error('page errors:', errors);
  process.exit(1);
}
