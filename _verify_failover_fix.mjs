import { chromium } from '/Users/kapildev/.npm/_npx/6f4879659183bc49/node_modules/playwright/index.mjs';

const BASE = process.argv[2] || 'http://127.0.0.1:8788';
const PATH = '/movie/969681';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

const switches = [];
page.on('response', (r) => {
  const m = r.url().match(/\/api\/embed\/movie\/\d+\?server=([a-z]+)&_=(\d+)/);
  if (m) switches.push(`t+${Date.now() - t0}ms  server=${m[1]} reload=${m[2]}`);
});

await page.goto(BASE + PATH, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(6000);

const p = await page.evaluate(() => {
  const w = document.querySelector('#watch');
  const b = [...w.querySelectorAll('button,[role="button"]')].find((el) =>
    /play|watch/i.test((el.getAttribute('aria-label') || '') + ' ' + (el.textContent || ''))
  );
  if (!b) return false;
  b.setAttribute('data-diag-play', '1');
  return true;
});
if (!p) { console.log('no play button'); process.exit(1); }
globalThis.t0 = Date.now();
var t0 = Date.now();
await page.click('[data-diag-play="1"]');

// Watch for 25s — well past the 9s LOAD_TIMEOUT_MS.
for (let i = 1; i <= 5; i++) {
  await page.waitForTimeout(5000);
  const s = await page.evaluate(() => {
    const f = document.querySelector('#watch iframe');
    const w = document.querySelector('#watch');
    const txt = (w?.textContent || '').replace(/\s+/g, ' ');
    return {
      src: f ? f.getAttribute('src') : null,
      err: /did not respond|Switched to|Reload/i.test(txt) ? txt.match(/.{0,80}(did not respond|Switched to).{0,60}/i)?.[0] : null,
    };
  });
  console.log(`t+${i * 5}s  iframe=${s.src}  ${s.err ? 'NOTICE: ' + s.err : ''}`);
}
console.log('\n--- embed navigations ---');
console.log(switches.join('\n'));
await browser.close();
