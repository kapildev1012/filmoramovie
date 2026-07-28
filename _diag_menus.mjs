// _diag_menus.mjs — are the in-player .fp-menu "bottom sheets" actually at the
// bottom of the screen on a phone? Temporary diagnostic; delete after use.
import { chromium, devices } from '/Users/kapildev/.npm/_npx/6f4879659183bc49/node_modules/playwright/index.mjs';

const URL = process.argv[2] ?? 'http://localhost:4321/movie/19995';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], hasTouch: true, isMobile: true });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(3500);
await page.evaluate(() => {
  document.querySelector('astro-dev-toolbar')?.remove();
  document.querySelector('.cookie-banner')?.remove();
});
const splash = page.locator('.fp-splash').first();
if (await splash.count()) await splash.click({ timeout: 6000 }).catch(() => {});
await page.waitForTimeout(4500);
await page.evaluate(() => document.querySelector('astro-dev-toolbar')?.remove());

// Reveal the control bar, then find any menu-opening button in the stage.
await page.locator('.fp-stage').first().click({ position: { x: 30, y: 30 } }).catch(() => {});
await page.waitForTimeout(600);

const buttons = await page.evaluate(() =>
  [...document.querySelectorAll('.fp-stage button')].map((b, i) => ({
    i,
    cls: (b.className || '').toString().slice(0, 60),
    label: b.getAttribute('aria-label') || b.textContent.trim().slice(0, 24),
    haspopup: b.getAttribute('aria-haspopup'),
  })).filter((b) => b.haspopup || /more|option|setting|track|subtitle|speed|episode/i.test(b.label))
);
console.log('MENU BUTTONS: ' + JSON.stringify(buttons, null, 2));

for (const b of buttons.slice(0, 4)) {
  await page.evaluate((i) => document.querySelectorAll('.fp-stage button')[i]?.click(), b.i);
  await page.waitForTimeout(700);
  const m = await page.evaluate(() => {
    const menu = document.querySelector('.fp-menu');
    if (!menu) return { present: false };
    const r = menu.getBoundingClientRect();
    const cs = getComputedStyle(menu);
    return {
      present: true,
      position: cs.position,
      y: Math.round(r.y), bottom: Math.round(r.bottom), h: Math.round(r.height), w: Math.round(r.width),
      viewportH: innerHeight, viewportW: innerWidth,
      pinnedToViewportBottom: Math.abs(r.bottom - innerHeight) <= 1,
      spansViewportWidth: Math.abs(r.width - innerWidth) <= 1,
      offBottom: Math.round(r.bottom - innerHeight),
    };
  });
  console.log(`  [${b.label}] -> ` + JSON.stringify(m));
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(300);
}
await page.screenshot({ path: '/tmp/diag-menus.png' });
await browser.close();
