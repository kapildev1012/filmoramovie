// _diag_sheet.mjs — why is .fp-server-sheet (position:fixed) not at the viewport bottom?
// Temporary diagnostic; delete after use.
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
await page.waitForTimeout(4000);

const trigger = page.locator('.fp-server-trigger').first();
await trigger.scrollIntoViewIfNeeded().catch(() => {});
await trigger.click({ timeout: 8000 }).catch(() => {});
await page.waitForTimeout(600);

const diag = await page.evaluate(() => {
  const sheet = document.querySelector('.fp-server-sheet');
  const backdrop = document.querySelector('.fp-sheet-backdrop');
  if (!sheet) return { error: 'no sheet' };
  const r = sheet.getBoundingClientRect();
  const br = backdrop?.getBoundingClientRect();

  // Walk ancestors looking for anything that creates a containing block for
  // position:fixed (transform, filter, perspective, contain, will-change,
  // backdrop-filter, container-type).
  const culprits = [];
  let el = sheet.parentElement;
  while (el && el !== document.documentElement) {
    const cs = getComputedStyle(el);
    const reasons = [];
    if (cs.transform !== 'none') reasons.push(`transform:${cs.transform}`);
    if (cs.filter !== 'none') reasons.push(`filter:${cs.filter}`);
    if (cs.backdropFilter && cs.backdropFilter !== 'none') reasons.push(`backdrop-filter:${cs.backdropFilter}`);
    if (cs.perspective !== 'none') reasons.push(`perspective:${cs.perspective}`);
    if (cs.contain && !['none', 'normal'].includes(cs.contain)) reasons.push(`contain:${cs.contain}`);
    if (cs.willChange && !['auto'].includes(cs.willChange)) reasons.push(`will-change:${cs.willChange}`);
    if (cs.containerType && cs.containerType !== 'normal') reasons.push(`container-type:${cs.containerType}`);
    if (reasons.length) {
      culprits.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className || '').toString().slice(0, 90),
        reasons,
        hasDataReveal: el.hasAttribute('data-reveal'),
      });
    }
    el = el.parentElement;
  }

  return {
    viewport: { w: innerWidth, h: innerHeight },
    sheet: { y: Math.round(r.y), bottom: Math.round(r.bottom), h: Math.round(r.height), w: Math.round(r.width), position: getComputedStyle(sheet).position },
    expectedBottom: innerHeight,
    pinnedToViewportBottom: Math.abs(r.bottom - innerHeight) <= 1,
    backdrop: br ? { y: Math.round(br.y), h: Math.round(br.height), w: Math.round(br.width), coversViewport: Math.round(br.height) >= innerHeight } : null,
    containingBlockCulprits: culprits,
  };
});
console.log(JSON.stringify(diag, null, 2));
await page.screenshot({ path: '/tmp/diag-sheet.png' });
await browser.close();
