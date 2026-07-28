// Verification: (1) server picker usable on a phone WITH the consent bar up,
// (2) the embed-engine CSS rules actually apply at phone width.
import { chromium, devices } from '/Users/kapildev/.npm/_npx/6f4879659183bc49/node_modules/playwright/index.mjs';

const URL = process.argv[2] ?? 'http://localhost:4321/movie/550';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(4500); // consent bar appears after 800ms
await page.evaluate(() => document.querySelector('astro-dev-toolbar')?.remove());

const consent = await page.evaluate(() => {
  const bar = document.querySelector('.cookie-banner');
  const root = document.documentElement;
  return {
    bannerPresent: !!bar,
    bannerHeight: bar ? Math.round(bar.getBoundingClientRect().height) : null,
    htmlHasClass: root.classList.contains('has-consent-bar'),
    reservedVar: getComputedStyle(root).getPropertyValue('--consent-bar-h').trim(),
    bodyPaddingBottom: getComputedStyle(document.body).paddingBottom,
  };
});
console.log('CONSENT RESERVATION: ' + JSON.stringify(consent, null, 2));

// Start playback so the embed engine mounts.
const splash = page.locator('.fp-splash').first();
if (await splash.count()) await splash.click({ timeout: 6000 }).catch(() => {});
await page.waitForTimeout(5000);
await page.evaluate(() => document.querySelector('astro-dev-toolbar')?.remove());

const css = await page.evaluate(() => {
  const stage = document.querySelector('.fp-stage');
  if (!stage) return { error: 'no stage' };
  const cs = getComputedStyle(stage);
  const controls = document.querySelector('.fp-stage .fp-controls');
  const badge = document.querySelector('.fp-stage .fp-quality-badge');
  const toast = document.querySelector('.fp-stage .fp-toast');
  return {
    stageClasses: stage.className,
    nativeBarH: cs.getPropertyValue('--fp-native-bar-h').trim(),
    stageOverflow: cs.overflow,
    controlsBottom: controls ? getComputedStyle(controls).bottom : null,
    badgePointerEvents: badge ? getComputedStyle(badge).pointerEvents : 'n/a',
    toastPointerEvents: toast ? getComputedStyle(toast).pointerEvents : 'n/a',
  };
});
console.log('EMBED CSS AT PHONE WIDTH: ' + JSON.stringify(css, null, 2));

// Now the actual regression: tap the server button with the consent bar still up.
const trigger = page.locator('.fp-server-trigger').first();
if (!(await trigger.count())) {
  console.log('RESULT: no server trigger in DOM');
} else {
  await trigger.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(400);
  const cover = await page.evaluate(() => {
    const el = document.querySelector('.fp-server-trigger');
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { y: Math.round(r.y), viewportH: innerHeight, topElement: top ? (top.className || top.tagName) + '' : null, coveredBySelf: el.contains(top) };
  });
  console.log('TRIGGER HIT TEST: ' + JSON.stringify(cover));
  const before = await page.locator('.fp-server-trigger-name').first().textContent();
  try { await trigger.click({ timeout: 8000 }); console.log('TRIGGER CLICK: ok'); }
  catch (e) { console.log('TRIGGER CLICK FAILED: ' + e.message.split('\n')[0]); }
  await page.waitForTimeout(900);
  const rows = await page.locator('.fp-server-row').count();
  console.log('SHEET ROWS: ' + rows);
  if (rows > 1) {
    const row = page.locator('.fp-server-row').nth(1);
    const name = (await row.locator('.fp-server-row-name').textContent())?.trim();
    try { await row.click({ timeout: 6000 }); console.log('ROW CLICK ok -> wanted: ' + name); }
    catch (e) { console.log('ROW CLICK FAILED: ' + e.message.split('\n')[0]); }
    await page.waitForTimeout(1500);
    const after = (await page.locator('.fp-server-trigger-name').first().textContent())?.trim();
    console.log('ACTIVE SERVER: before="' + before.trim() + '" after="' + after + '"');
    console.log('SWITCH WORKED: ' + (after !== before.trim()));
  }
  await page.screenshot({ path: '/tmp/mobile-verify.png' });
}
await browser.close();
