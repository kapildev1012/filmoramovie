// TEMPORARY verification script (phase 2) — server selection + SourceBar CSS on
// the real movie page, where the embed engine and its server list exist.
const { chromium } = require('/Users/kapildev/.npm/_npx/6f4879659183bc49/node_modules/playwright');

const URL = 'http://localhost:4321/movie/550';
const SIZES = [
  { name: 'mobile', width: 390, height: 844, touch: true },
  { name: 'tablet', width: 834, height: 1112, touch: true },
  { name: 'desktop', width: 1440, height: 900, touch: false },
];

const results = [];
const fail = [];
function check(label, ok, detail) {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) fail.push(label);
}

const serverGroup = (page) => page.locator('.fp-source-group').nth(1);

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });

  for (const size of SIZES) {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      hasTouch: size.touch,
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => {
      if ((e.stack || '').includes('react-three-fiber')) return;
      errors.push(e.message);
    });
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.fp-sourcebar', { timeout: 20000 });
    await page.waitForTimeout(3000); // let /api/embed/servers land

    check(`[${size.name}] movie page has no page errors`, errors.length === 0, errors.join(' | '));

    const compact = size.width <= 640;
    const hasTrigger = await page.locator('.fp-server-trigger').count();
    check(
      `[${size.name}] ${compact ? 'compact trigger' : 'inline pills'} presentation chosen`,
      compact ? hasTrigger === 1 : hasTrigger === 0,
      `trigger=${hasTrigger}`
    );

    if (compact) {
      // ── Bottom sheet: opens, rows are ≥44px, selecting closes it ──
      const trigger = page.locator('.fp-server-trigger');
      const th = (await trigger.boundingBox()).height;
      check(`[${size.name}] server trigger is a ≥44px target`, th >= 44, `${Math.round(th)}px`);
      await trigger.click();
      await page.waitForSelector('.fp-server-sheet', { timeout: 5000 });
      const rows = await page.evaluate(() => {
        const out = [];
        document.querySelectorAll('.fp-server-row').forEach((el) => {
          const r = el.getBoundingClientRect();
          out.push({ h: Math.round(r.height), w: Math.round(r.width), right: Math.round(r.right) });
        });
        return { rows: out, vw: window.innerWidth, sheet: document.querySelector('.fp-server-sheet').getBoundingClientRect().height };
      });
      check(
        `[${size.name}] every sheet row is a ≥44px target`,
        rows.rows.length > 0 && rows.rows.every((r) => r.h >= 44),
        `rows=${JSON.stringify(rows.rows.map((r) => r.h))}`
      );
      check(
        `[${size.name}] sheet does not overflow the viewport`,
        rows.rows.every((r) => r.right <= rows.vw + 1),
        `vw=${rows.vw} maxRight=${Math.max(...rows.rows.map((r) => r.right))}`
      );
      const before = (await trigger.textContent()).trim();
      await page.locator('.fp-server-row').last().click();
      await page.waitForTimeout(800);
      const sheetGone = (await page.locator('.fp-server-sheet').count()) === 0;
      const after = (await page.locator('.fp-server-trigger').textContent()).trim();
      check(
        `[${size.name}] picking a server closes the sheet and updates the trigger`,
        sheetGone && after !== before,
        `sheet=${sheetGone} "${before}" -> "${after}"`
      );
      // Override must survive a reload (sessionStorage, per title).
      const chosen = after.replace(/AUTO|Auto/g, '').trim();
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.fp-server-trigger', { timeout: 20000 });
      await page.waitForTimeout(3000);
      const restored = (await page.locator('.fp-server-trigger').textContent()).trim();
      check(
        `[${size.name}] manual server choice survives a reload`,
        restored.includes(chosen.split(' ')[0]),
        `chose "${chosen}" -> after reload "${restored}"`
      );
    } else {
      // ── Ranking: the auto-selected server is the ranked leader ──
      const state = await page.evaluate(() => {
        const group = document.querySelectorAll('.fp-source-group')[1];
        const pills = [...group.querySelectorAll('.fp-pill')];
        return {
          order: pills.map((p) => p.textContent.trim()),
          activeIndex: pills.findIndex((p) => p.classList.contains('is-active')),
          bestBadges: pills.map((p) => !!p.querySelector('.fp-quality-badge.is-best')),
          heights: pills.map((p) => Math.round(p.getBoundingClientRect().height)),
        };
      });
      check(
        `[${size.name}] auto-selected server is the top-ranked one`,
        state.activeIndex === 0,
        `activeIndex=${state.activeIndex} order=${JSON.stringify(state.order)}`
      );
      check(
        `[${size.name}] only the ranked leader carries the "Best" badge`,
        state.bestBadges[0] === true && state.bestBadges.slice(1).every((b) => !b),
        `badges=${JSON.stringify(state.bestBadges)}`
      );
      check(
        `[${size.name}] server pills are ≥${size.touch ? 44 : 36}px tall`,
        Math.min(...state.heights) >= (size.touch ? 44 : 36),
        `heights=${JSON.stringify(state.heights)}`
      );

      // ── Manual override → Auto pill appears → survives reload ──
      const pills = serverGroup(page).locator('.fp-pill');
      const count = await pills.count();
      const chosen = (await pills.nth(count - 1).textContent()).trim().split('\n')[0];
      await pills.nth(count - 1).click();
      await page.waitForTimeout(800);
      const autoPill = await page.locator('.fp-pill-auto').isVisible().catch(() => false);
      check(
        `[${size.name}] manual pick offers a way back to Auto`,
        autoPill,
        `picked=${chosen} autoPill=${autoPill}`
      );
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.fp-sourcebar', { timeout: 20000 });
      await page.waitForTimeout(3000);
      const restored = await page.evaluate(() => {
        const group = document.querySelectorAll('.fp-source-group')[1];
        const active = group.querySelector('.fp-pill.is-active');
        return active ? active.textContent.trim() : null;
      });
      check(
        `[${size.name}] manual server choice survives a reload`,
        !!restored && restored.startsWith(chosen.replace(/Best$/, '').trim().slice(0, 4)),
        `chose "${chosen}" -> after reload "${restored}"`
      );
      // ── Back to Auto restores the ranked leader ──
      await page.locator('.fp-pill-auto').click();
      await page.waitForTimeout(800);
      const backToAuto = await page.evaluate(() => {
        const group = document.querySelectorAll('.fp-source-group')[1];
        const pills = [...group.querySelectorAll('.fp-pill')].filter(
          (p) => !p.classList.contains('fp-pill-auto')
        );
        return {
          activeIndex: pills.findIndex((p) => p.classList.contains('is-active')),
          autoStillThere: !!document.querySelector('.fp-pill-auto'),
        };
      });
      check(
        `[${size.name}] "Auto" returns to the ranked leader and hides itself`,
        backToAuto.activeIndex === 0 && !backToAuto.autoStillThere,
        JSON.stringify(backToAuto)
      );
    }

    // ── No overflow of the source bar at any width ──
    const overflow = await page.evaluate(() => {
      const bar = document.querySelector('.fp-sourcebar');
      const r = bar.getBoundingClientRect();
      const bad = [];
      bar.querySelectorAll('*').forEach((el) => {
        const b = el.getBoundingClientRect();
        if (b.width && (b.left < r.left - 1 || b.right > r.right + 1)) bad.push(el.className);
      });
      return { bad: bad.slice(0, 5), doc: document.documentElement.scrollWidth > window.innerWidth + 1 };
    });
    check(
      `[${size.name}] source bar does not overflow`,
      overflow.bad.length === 0 && !overflow.doc,
      `offenders=${JSON.stringify(overflow.bad)} docOverflow=${overflow.doc}`
    );

    await page.screenshot({ path: `/tmp/fp-servers-${size.name}.png` });
    await context.close();
  }

  await browser.close();
  console.log(results.join('\n'));
  console.log(`\n${results.filter((r) => r.startsWith('PASS')).length} passed, ${fail.length} failed`);
  if (fail.length) process.exitCode = 1;
})();
