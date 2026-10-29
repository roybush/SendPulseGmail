// Renders icon.svg / icon-16.svg into public/icons.
//   PLAYWRIGHT=/path/to/node_modules/playwright node store/src/icon/render.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const here = (name) => fileURLToPath(new URL(name, import.meta.url));
const out = (name) => fileURLToPath(new URL(`../../../public/icons/${name}`, import.meta.url));

const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
for (const [svg, size, file] of [
  ['icon.svg', 128, 'icon-128.png'],
  ['icon.svg', 48, 'icon-48.png'],
  ['icon-16.svg', 16, 'icon-16.png'],
  ['icon-16.svg', 32, 'icon-32.png'],
]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const markup = readFileSync(here(svg), 'utf8').replace(
    /width="\d+" height="\d+"/,
    `width="${size}" height="${size}"`,
  );
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block}</style>${markup}`,
  );
  await page.screenshot({ path: out(file), omitBackground: true });
  await page.close();
}
await browser.close();
