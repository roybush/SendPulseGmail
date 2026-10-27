// Renders Chrome Web Store images into store/images.
//
//   npx vite --config store/src/vite.config.mjs &     # serves the screenshot scenes on :5299
//   PLAYWRIGHT=/path/to/node_modules/playwright node store/src/render.mjs
//
// Playwright isn't a project dependency; install it anywhere (`npm i playwright && npx playwright
// install chromium`) and point PLAYWRIGHT at it. Output is PNG; the store wants no alpha channel,
// so convert with `sips -s format jpeg` (macOS) or any image tool if it complains.
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const out = (name) => fileURLToPath(new URL(`../images/${name}`, import.meta.url));
const tile = (name) => new URL(`./tiles/${name}`, import.meta.url).href;
const SERVER = 'http://localhost:5299/screens/';

const SCENES = [
  {
    name: 'screenshot-1-contacts.png',
    scene: 'contacts',
    caption: 'Everyone in the conversation, with their SendPulse status',
  },
  {
    name: 'screenshot-2-details.png',
    scene: 'details',
    caption: 'Contact details picked up from the email signature',
  },
  {
    name: 'screenshot-3-fields.png',
    scene: 'fields',
    caption: 'Choose once where each field goes in your mailing list',
  },
  {
    name: 'screenshot-4-connect.png',
    scene: 'connect',
    caption: 'Connect with a SendPulse API key in seconds',
  },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

for (const { name, scene, caption } of SCENES) {
  await page.goto(`${SERVER}?scene=${scene}`);
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
      () => document.querySelectorAll('.sp-status').length && !document.body.innerText.includes('Checking'),
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

  if (scene === 'details') {
    // The marquee shows this panel on its own.
    const side = await page.locator('.side').boundingBox();
    await page.screenshot({
      path: fileURLToPath(new URL('./tiles/panel.png', import.meta.url)),
      clip: { x: side.x, y: side.y, width: side.width, height: Math.min(side.height, 560) },
      scale: 'device',
    });
  }
}

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
