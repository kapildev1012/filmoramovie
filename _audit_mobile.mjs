// _audit_mobile.mjs — verify the server picker + streaming layout on phones.
// Temporary verification harness; delete after use.
import { chromium, devices } from '/Users/kapildev/.npm/_npx/6f4879659183bc49/node_modules/playwright/index.mjs';

const URL = process.argv[2] ?? 'http://localhost:4321/movie/19995';
const TARGETS = [
  ['iPhone SE  320x568', { width: 320, height: 568 }],
  ['iPhone 13  390x844', { width: 390, height: 844 }],
  ['Pixel 7    412x915', { width: 412, height: 915 }],
  ['landscape  844x390', { width: 844, height: 390 }],
];

const browser = await chromium.launch();
let failures = 0;

for (const [label, viewport] of TARGETS) {
  const ctx = await browser.newContext({
    ...devices['iPhone 13'], viewport, hasTouch: true, isMobile: true, deviceScaleFactor: 2,
  });
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

  const issues = [];
  const push = (m) => { issues.push(m); failures++; };

  // Above 40rem the component deliberately renders inline server pills instead
  // of the trigger+popover (useCompactViewport), and a short landscape viewport
  // deliberately lets the stage fill the height instead of holding 16:9 — so both
  // expectations are conditional on the viewport, not universal.
  const isCompact = viewport.width <= 640;
  const isShortLandscape = viewport.height <= 480 && viewport.width > viewport.height;

  // ── Page-level: no horizontal overflow, stage 16:9, controls reachable ──
  const base = await page.evaluate((vw) => {
    const r = (el) => { const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
    const stage = document.querySelector('.fp-stage');
    const trig = document.querySelector('.fp-server-trigger');
    const pills = [...document.querySelectorAll('.fp-sourcebar .fp-pill')];
    const wtw = document.querySelector('#where-to-watch');
    return {
      docW: document.documentElement.scrollWidth,
      vw,
      stage: stage ? { ...r(stage), aspect: +(stage.getBoundingClientRect().width / stage.getBoundingClientRect().height).toFixed(3) } : null,
      trigger: trig ? r(trig) : null,
      pills: pills.map((p) => ({ t: p.textContent.trim().slice(0, 18), ...r(p) })),
      wtw: wtw ? { ...r(wtw), display: getComputedStyle(wtw).display } : null,
    };
  }, viewport.width);

  if (base.docW > base.vw + 1) push(`page overflows horizontally (${base.docW} > ${base.vw})`);
  if (base.stage && !isShortLandscape && Math.abs(base.stage.aspect - 1.778) > 0.05) push(`stage aspect ${base.stage.aspect} not 16:9`);
  if (base.stage && base.stage.x + base.stage.w > base.vw + 1) push('stage overflows right edge');
  if (isCompact && !base.trigger) push('no server trigger rendered at phone width');
  if (!isCompact && base.pills.length < 2) push('no inline server pills rendered at wide width');
  if (base.trigger && base.trigger.h < 44) push(`server trigger ${base.trigger.h}px tall (<44)`);
  // Every pill is a touch target on a touch device, in both presentations.
  for (const p of base.pills) if (p.h < 44) push(`pill "${p.t}" ${p.h}px tall (<44)`);
  if (base.wtw && base.wtw.x + base.wtw.w > base.vw + 1) push('where-to-watch overflows right edge');

  // ── Open the popover ──
  const trigger = page.locator('.fp-server-trigger').first();
  let pop = { present: false };
  if (await trigger.count()) {
    await trigger.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(250);
    await trigger.click({ timeout: 8000 }).catch(() => push('trigger click failed'));
    await page.waitForTimeout(700);
    pop = await page.evaluate(() => {
      const el = document.querySelector('.fp-server-popover');
      if (!el) return { present: false };
      const cs = getComputedStyle(el);
      const b = el.getBoundingClientRect();
      const t = document.querySelector('.fp-server-trigger').getBoundingClientRect();
      const rows = [...document.querySelectorAll('.fp-server-row')].map((x) => {
        const rr = x.getBoundingClientRect();
        return { name: x.querySelector('.fp-server-row-name')?.textContent.trim(), h: Math.round(rr.height), w: Math.round(rr.width), right: Math.round(rr.right) };
      });
      // Is the popover actually the topmost thing at its own centre?
      const cx = b.x + b.width / 2, cy = b.y + Math.min(30, b.height / 2);
      const top = document.elementFromPoint(cx, cy);
      return {
        present: true,
        position: cs.position, zIndex: cs.zIndex, bg: cs.backgroundColor, borderW: cs.borderTopWidth,
        rect: { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), right: Math.round(b.right), bottom: Math.round(b.bottom) },
        trigger: { y: Math.round(t.y), bottom: Math.round(t.bottom) },
        vw: innerWidth, vh: innerHeight,
        rows,
        topmost: top ? (top.className || top.tagName).toString().slice(0, 40) : null,
        popoverContainsTopmost: top ? el.contains(top) : false,
        scrollable: el.scrollHeight > el.clientHeight + 1,
      };
    });

    if (!pop.present) push('popover did not open');
    else {
      if (pop.position !== 'fixed') push(`popover position:${pop.position} (expected fixed)`);
      if (pop.bg === 'rgba(0, 0, 0, 0)') push('popover background is transparent');
      if (pop.borderW === '0px') push('popover has no border');
      if (pop.rect.y < 0 || pop.rect.bottom > pop.vh + 1) push(`popover vertically outside viewport (y=${pop.rect.y}, bottom=${pop.rect.bottom}, vh=${pop.vh})`);
      if (pop.rect.x < 0 || pop.rect.right > pop.vw + 1) push(`popover horizontally outside viewport (x=${pop.rect.x}, right=${pop.rect.right}, vw=${pop.vw})`);
      const anchored = Math.abs(pop.rect.bottom - pop.trigger.y) < 24 || Math.abs(pop.rect.y - pop.trigger.bottom) < 24;
      if (!anchored) push(`popover not anchored to trigger (pop ${pop.rect.y}-${pop.rect.bottom}, trigger ${pop.trigger.y}-${pop.trigger.bottom})`);
      if (!pop.popoverContainsTopmost) push(`popover is covered by "${pop.topmost}"`);
      if (!pop.rows.length) push('popover has no server rows');
      for (const r of pop.rows) {
        if (r.h < 44) push(`row "${r.name}" ${r.h}px tall (<44)`);
        if (r.right > pop.rect.right + 1) push(`row "${r.name}" overflows popover`);
      }
    }
  }

  // ── Switching a server actually changes the active one ──
  let switched = null;
  if (pop.present && pop.rows.length > 1) {
    const before = (await page.locator('.fp-server-trigger-name').first().textContent())?.trim();
    const row = page.locator('.fp-server-row').nth(1);
    const wanted = (await row.locator('.fp-server-row-name').textContent())?.trim();
    await row.click({ timeout: 6000 }).catch(() => push('row click failed'));
    await page.waitForTimeout(1600);
    const after = (await page.locator('.fp-server-trigger-name').first().textContent())?.trim();
    switched = { before, wanted, after, ok: after !== before };
    if (!switched.ok) push(`server switch did not take effect (still "${after}")`);
    const stillOpen = await page.locator('.fp-server-popover').count();
    if (stillOpen) push('popover stayed open after choosing a server');
  }

  console.log(`\n===== ${label} =====`);
  console.log('  layout: ' + JSON.stringify({ docW: base.docW, stage: base.stage, trigger: base.trigger, wtwDisplay: base.wtw?.display }));
  if (pop.present) console.log('  popover: ' + JSON.stringify({ position: pop.position, z: pop.zIndex, bg: pop.bg, rect: pop.rect, rows: pop.rows.map((r) => `${r.name}:${r.h}px`), scrollable: pop.scrollable, topmostOk: pop.popoverContainsTopmost }));
  if (switched) console.log('  switch: ' + JSON.stringify(switched));
  console.log(issues.length ? '  ISSUES:\n    - ' + issues.join('\n    - ') : '  ISSUES: none');

  await page.screenshot({ path: `/tmp/audit-${viewport.width}x${viewport.height}.png` });
  await ctx.close();
}

console.log(`\n================ TOTAL ISSUES: ${failures} ================`);
await browser.close();
process.exit(failures ? 1 : 0);
