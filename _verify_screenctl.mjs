import { chromium, devices } from '/Users/kapildev/.npm/_npx/6f4879659183bc49/node_modules/playwright/index.mjs';

const BASE = process.argv[2] || 'http://127.0.0.1:8788';
const URL = BASE + '/movie/969681';

const browser = await chromium.launch();

const state = (page) =>
  page.evaluate(() => {
    const c = document.querySelector('.fp-embed-screen-control');
    const wake = document.querySelector('.fp-embed-wake');
    if (!c) return { present: false };
    return {
      present: true,
      visible: c.classList.contains('is-visible'),
      opacity: getComputedStyle(c).opacity,
      btnPointerEvents: getComputedStyle(document.querySelector('.fp-embed-screen-btn')).pointerEvents,
      wakeLayer: !!wake,
    };
  });

async function start(page) {
  // The provider frame is flaky from this machine; on an error the control is not
  // rendered at all (by design), so retry the whole start until it appears.
  for (let attempt = 1; attempt <= 4; attempt++) {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('.fp-splash-play', { timeout: 25000 });
    await page.locator('.fp-splash-play').click();
    try {
      await page.waitForSelector('.fp-embed-screen-control', {
        state: 'attached',
        timeout: 12000,
      });
      return;
    } catch {
      const err = await page.evaluate(
        () => (document.querySelector('.fp-stage')?.innerText || '').replace(/\s+/g, ' ').slice(0, 90)
      );
      console.log(`  (attempt ${attempt}: control absent — stage says "${err}")`);
    }
  }
  throw new Error('control never rendered');
}

// ── Desktop (mouse) ───────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await start(page);
  console.log('\n=== DESKTOP');
  console.log(' on start        ', JSON.stringify(await state(page)));
  await page.waitForTimeout(1500);
  console.log(' +1.5s idle      ', JSON.stringify(await state(page)));

  // Move the mouse in from outside the stage -> mouseenter reveal.
  const box = await page.locator('.fp-stage').boundingBox();
  await page.mouse.move(box.x - 40, box.y - 40);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(150);
  console.log(' after mouse in  ', JSON.stringify(await state(page)));
  await page.waitForTimeout(1500);
  console.log(' +1.5s (cursor still on video)', JSON.stringify(await state(page)));

  // Hover the button itself -> must stay.
  await page.mouse.move(box.x - 40, box.y - 40);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(100);
  const bb = await page.locator('.fp-embed-screen-btn').boundingBox();
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await page.waitForTimeout(1800);
  console.log(' hovering button after 1.8s   ', JSON.stringify(await state(page)));
  await ctx.close();
}

// ── Touch phone ───────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ ...devices['iPhone 13'], hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await start(page);
  console.log('\n=== TOUCH (iPhone 13)');
  console.log(' on start        ', JSON.stringify(await state(page)));
  await page.waitForTimeout(1500);
  console.log(' +1.5s idle      ', JSON.stringify(await state(page)));

  const box = await page.locator('.fp-stage').boundingBox();
  await page.locator('.fp-embed-wake').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  console.log(' before tap      ', JSON.stringify(await state(page)));
  await page.locator('.fp-embed-wake').tap();
  await page.waitForTimeout(200);
  console.log(' after tap       ', JSON.stringify(await state(page)));
  await page.waitForTimeout(1500);
  console.log(' +1.5s after tap ', JSON.stringify(await state(page)));
  void box;
  await ctx.close();
}

await browser.close();
