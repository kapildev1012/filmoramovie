// Temporary repro: is the server picker usable on a phone viewport?
import { chromium, devices } from '/Users/kapildev/.npm/_npx/6f4879659183bc49/node_modules/playwright/index.mjs';

const URL = process.argv[2] ?? 'http://localhost:4321/movie/550';

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
// Pre-dismiss the first-visit cookie bar; it is not what we are testing.
await ctx.addInitScript(() => {
  localStorage.setItem('filmora_consent', 'all');
  localStorage.setItem('filmora_consent_prefs', '{"analytics":true,"marketing":true}');
});
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(3500);
// Remove the Astro dev toolbar: dev-only chrome, also pinned bottom-centre.
await page.evaluate(() => document.querySelector('astro-dev-toolbar')?.remove());

const snap = async (label) => {
  const info = await page.evaluate(() => {
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
      const top = document.elementFromPoint(cx, cy);
      return {
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        pointerEvents: cs.pointerEvents, position: cs.position, zIndex: cs.zIndex,
        inViewport: r.y < innerHeight && r.y + r.height > 0,
        topElementAtCentre: top ? (top.className || top.tagName) + '' : null,
        centreIsSelfOrChild: top ? (el.contains(top) || top === el) : false,
      };
    };
    return {
      viewport: { w: innerWidth, h: innerHeight },
      scrollY: Math.round(scrollY),
      trigger: box(document.querySelector('.fp-server-trigger')),
      sheet: box(document.querySelector('.fp-server-sheet')),
      backdrop: box(document.querySelector('.fp-sheet-backdrop')),
      rows: document.querySelectorAll('.fp-server-row').length,
      activeServerLabel: document.querySelector('.fp-server-trigger-name')?.textContent?.trim() ?? null,
    };
  });
  console.log('--- ' + label + ' ---\n' + JSON.stringify(info, null, 2));
  return info;
};

const play = page.locator('.fp-splash').first();
if (await play.count()) await play.click({ timeout: 5000 }).catch((e) => console.log('play click: ' + e.message.split('\n')[0]));
await page.waitForTimeout(5000);
await page.evaluate(() => document.querySelector('astro-dev-toolbar')?.remove());

const trigger = page.locator('.fp-server-trigger').first();
if (!(await trigger.count())) {
  console.log('NO .fp-server-trigger IN DOM');
} else {
  await trigger.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(400);
  const before = await snap('trigger in view, sheet closed');
  try { await trigger.click({ timeout: 6000 }); console.log('TRIGGER CLICK: ok'); }
  catch (e) { console.log('TRIGGER CLICK FAILED: ' + e.message.split('\n')[0]); }
  await page.waitForTimeout(900);
  const after = await snap('after trigger click');
  if (!after.sheet) console.log('RESULT: sheet did not open');
  else {
    console.log('RESULT: sheet open, inViewport=' + after.sheet.inViewport + ', rows=' + after.rows);
    const row = page.locator('.fp-server-row').nth(1);
    if (await row.count()) {
      const rb = await row.boundingBox();
      console.log('row1 box: ' + JSON.stringify(rb));
      try { await row.click({ timeout: 5000 }); console.log('ROW CLICK: ok'); }
      catch (e) { console.log('ROW CLICK FAILED: ' + e.message.split('\n')[0]); }
      await page.waitForTimeout(1200);
      await snap('after row click');
    }
  }
  await page.screenshot({ path: '/tmp/mobile-server.png', fullPage: false });
  console.log('screenshot: /tmp/mobile-server.png');
}

console.log('=== page errors ===\n' + (errors.filter((e) => !/Permissions policy|ERR_CERT/.test(e)).slice(0, 10).join('\n') || '(none relevant)'));
await browser.close();
