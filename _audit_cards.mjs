import { chromium } from '/Users/kapildev/.npm/_npx/6f4879659183bc49/node_modules/playwright/index.mjs';

const BASE = 'http://localhost:4321';
const PATHS = [
  '/', '/movies', '/series', '/anime', '/search?q=star',
  '/netflix', '/prime', '/disney', '/hotstar', '/appletv', '/continue',
];
const WIDTHS = [320, 360, 390, 430];

const browser = await chromium.launch();
const rows = [];

async function load(page, url) {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      if (res && res.status() < 400) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

for (const path of PATHS) {
  for (const w of WIDTHS) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 } });
    if (!(await load(page, BASE + path))) {
      rows.push({ path, w, container: 'LOAD-FAILED' });
      await page.close();
      continue;
    }
    await page.click('text=Accept all', { timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 500) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 50));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(900);

    const r = await page.evaluate(() => {
      const innerW = window.innerWidth;
      const groups = new Map();
      document.querySelectorAll('.poster-card').forEach((card) => {
        const holder = card.closest('.poster-grid, .scroll-rail, .watchlist-grid, [class*=grid], [class*=rail]');
        if (!holder) return;
        const key = holder.className.toString().split(' ').filter((c) => !c.startsWith('astro-') && c !== 'is-revealed').join('.');
        if (!groups.has(key)) groups.set(key, { holder, cards: [] });
        groups.get(key).cards.push(card);
      });
      const out = [];
      for (const [key, { holder, cards }] of groups) {
        const boxes = cards.map((c) => c.getBoundingClientRect());
        const cs = getComputedStyle(holder);
        out.push({
          container: key,
          n: cards.length,
          widths: [...new Set(boxes.map((b) => Math.round(b.width)))].sort((a, b) => a - b),
          heights: [...new Set(boxes.map((b) => Math.round(b.height)))].sort((a, b) => a - b),
          leftPad: Math.round(Math.min(...boxes.map((b) => b.left))),
          rail: cs.overflowX === 'auto' || cs.overflowX === 'scroll',
        });
      }
      return { innerW, overflow: document.documentElement.scrollWidth - innerW, out };
    });

    if (r.out.length === 0) rows.push({ path, w, container: '(none)', overflow: r.overflow });
    for (const c of r.out) rows.push({ path, w, ...c, overflow: r.overflow });
    await page.close();
  }
}
await browser.close();

const pad = (s, n) => String(s).padEnd(n);
console.log([pad('path', 15), pad('w', 4), pad('container', 22), pad('n', 4), pad('cardW', 14), pad('cardH', 14), pad('lPad', 5), pad('type', 5), 'ovf'].join(' '));
for (const r of rows) {
  console.log([
    pad(r.path, 15), pad(r.w, 4), pad(r.container, 22), pad(r.n ?? '-', 4),
    pad(r.widths ? r.widths.join(',') : '-', 14),
    pad(r.heights ? r.heights.join(',') : '-', 14),
    pad(r.leftPad ?? '-', 5), pad(r.rail ? 'rail' : 'grid', 5), r.overflow ?? '-',
  ].join(' '));
}
