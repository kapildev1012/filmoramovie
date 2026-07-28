import { chromium } from '/Users/kapildev/.npm/_npx/6f4879659183bc49/node_modules/playwright/index.mjs';

const URL = process.argv[2] ?? 'http://localhost:4321/movie/550';
const browser = await chromium.launch();

for (const [label, size] of [['desktop 1440', { width: 1440, height: 900 }], ['ultrawide 1920', { width: 1920, height: 1080 }]]) {
  const ctx = await browser.newContext({ viewport: size });
  const page = await ctx.newPage();
  await ctx.addInitScript(() => localStorage.setItem('filmora_consent', 'all'));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(3500);
  await page.evaluate(() => document.querySelector('astro-dev-toolbar')?.remove());
  const splash = page.locator('.fp-splash').first();
  if (await splash.count()) await splash.click({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(4000);
  const info = await page.evaluate(() => {
    const stage = document.querySelector('.fp-stage');
    const cs = getComputedStyle(stage);
    const controls = document.querySelector('.fp-stage .fp-controls');
    const pills = [...document.querySelectorAll('.fp-sourcebar .fp-pill')];
    const hit = pills.map((p) => {
      const r = p.getBoundingClientRect();
      const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return { label: p.textContent.trim().slice(0, 14), reachable: p.contains(top) || top === p };
    });
    return {
      maxHeight: cs.maxHeight,
      nativeBarH: cs.getPropertyValue('--fp-native-bar-h').trim(),
      overflow: cs.overflow,
      controlsBottom: controls ? getComputedStyle(controls).bottom : null,
      serverPills: hit,
      consentBarClass: document.documentElement.classList.contains('has-consent-bar'),
      bodyPadBottom: getComputedStyle(document.body).paddingBottom,
    };
  });
  console.log('=== ' + label + ' ===\n' + JSON.stringify(info, null, 2));
  await ctx.close();
}
await browser.close();
