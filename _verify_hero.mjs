import { chromium } from '/Users/kapildev/.npm/_npx/6f4879659183bc49/node_modules/playwright/index.mjs';

const BASE = process.argv[2] ?? 'http://localhost:4399';
const PAGES = [
  ['/', 'full'],
  ['/movies', 'page'],
  ['/netflix', 'page'],
  ['/movie/550', 'detail'],
];
const VIEWPORTS = [
  ['mobile 390', { width: 390, height: 844 }],
  ['tablet 834', { width: 834, height: 1112 }],
  ['desktop 1440', { width: 1440, height: 900 }],
];

const browser = await chromium.launch();
let fail = 0;

for (const [path, expectVariant] of PAGES) {
  for (const [vpLabel, size] of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: size });
    await ctx.addInitScript(() => localStorage.setItem('filmora_consent', 'all'));
    const page = await ctx.newPage();
    await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForSelector('.nf-hero', { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(1200);

    const info = await page.evaluate(() => {
      const hero = document.querySelector('.nf-hero');
      if (!hero) return null;
      const copy = hero.querySelector('.nf-copy');
      const strip = hero.querySelector('.nf-strip');
      const dots = hero.querySelector('.nf-dots');
      const container = [...document.querySelectorAll('.container')].find(
        (c) => c.getBoundingClientRect().width > 0
      );
      const heroBox = hero.getBoundingClientRect();
      const cs = getComputedStyle(hero);
      const overflowsX = document.documentElement.scrollWidth > window.innerWidth + 1;
      const btns = [...hero.querySelectorAll('.nf-actions .nf-btn')].map((b) => {
        const r = b.getBoundingClientRect();
        return { text: b.textContent.trim(), w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top) };
      });
      // is any action button hidden behind the bottom edge / tab bar?
      const tab = document.querySelector('.btb-root');
      const tabTop = tab ? tab.getBoundingClientRect().top : Infinity;
      const lastBottom = Math.max(...[...hero.querySelectorAll('.nf-actions .nf-btn')].map((b) => b.getBoundingClientRect().bottom), 0);
      return {
        classes: hero.className,
        heroH: Math.round(heroBox.height),
        vh: window.innerHeight,
        gutter: cs.getPropertyValue('--nf-gutter').trim(),
        copyLeft: copy ? Math.round(copy.getBoundingClientRect().left) : null,
        copyWidth: copy ? Math.round(copy.getBoundingClientRect().width) : null,
        containerContentLeft: container
          ? Math.round(container.getBoundingClientRect().left + parseFloat(getComputedStyle(container).paddingLeft))
          : null,
        hasStrip: !!strip,
        dotsLeft: dots ? Math.round(dots.getBoundingClientRect().left) : null,
        navVisible: strip ? getComputedStyle(hero.querySelector('.nf-nav')).display !== 'none' : null,
        overflowsX,
        btns,
        actionsClearTabBar: lastBottom <= tabTop + 1,
        stripBottomGap: Math.round(heroBox.bottom - (strip ? strip.getBoundingClientRect().bottom : heroBox.bottom)),
      };
    });

    if (!info) {
      console.log(`❌ ${path} @ ${vpLabel}: no .nf-hero found`);
      fail++;
      await ctx.close();
      continue;
    }

    const checks = [];
    checks.push([`variant class nf-hero--${expectVariant}`, info.classes.includes(`nf-hero--${expectVariant}`)]);
    checks.push(['no horizontal overflow', !info.overflowsX]);
    checks.push(['hero height >= 50% vh', info.heroH >= info.vh * 0.5]);
    if (expectVariant === 'detail') {
      checks.push(['single slide → no carousel chrome', info.hasStrip === false]);
    } else {
      checks.push(['carousel chrome present', info.hasStrip === true]);
      if (size.width >= 768) {
        checks.push(['dots aligned to container gutter', Math.abs(info.dotsLeft - info.containerContentLeft) <= 2]);
        checks.push(['arrows/counter visible on >=768', info.navVisible === true]);
      } else {
        checks.push(['arrows hidden on mobile', info.navVisible === false]);
      }
    }
    if (info.containerContentLeft !== null && size.width >= 768) {
      checks.push(['copy aligned to container gutter', Math.abs(info.copyLeft - info.containerContentLeft) <= 2]);
    }
    checks.push(['2 action buttons', info.btns.length === 2]);
    checks.push(['action buttons >=44px tall', info.btns.every((b) => b.h >= 44)]);
    if (size.width < 768) {
      checks.push(['buttons on one row', info.btns.length === 2 && info.btns[0].top === info.btns[1].top]);
      checks.push(['actions clear the bottom tab bar', info.actionsClearTabBar]);
    }

    const bad = checks.filter(([, ok]) => !ok);
    fail += bad.length;
    console.log(
      `${bad.length ? '❌' : '✅'} ${path.padEnd(12)} @ ${vpLabel.padEnd(13)} h=${info.heroH}/${info.vh} gutter=${info.gutter} copyL=${info.copyLeft} contL=${info.containerContentLeft} dotsL=${info.dotsLeft} btns=${JSON.stringify(info.btns.map((b) => `${b.text}:${b.w}x${b.h}`))}`
    );
    bad.forEach(([name]) => console.log(`     ↳ FAILED: ${name}`));
    await ctx.close();
  }
}

await browser.close();
console.log(fail === 0 ? '\nALL HERO CHECKS PASSED' : `\n${fail} CHECK(S) FAILED`);
process.exit(fail === 0 ? 0 : 1);
