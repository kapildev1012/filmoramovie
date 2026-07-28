import { chromium, devices } from '/Users/kapildev/.npm/_npx/6f4879659183bc49/node_modules/playwright/index.mjs';

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
await page.goto(process.argv[2] ?? 'http://localhost:4321/movie/550', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(3500);

const out = await page.evaluate(() => {
  const wanted = [
    '.fp-stage.is-engine-embed .fp-controls',
    '.fp-stage.is-engine-embed:not(.is-zoomed)',
    '.fp-stage:not(.is-fullscreen)',
    '.fp-quality-badge',
    '--fp-native-bar-h',
  ];
  const found = [];
  const walk = (rules, conditions) => {
    for (const rule of rules) {
      if (rule.cssRules) {
        const cond = rule.conditionText ?? rule.media?.mediaText ?? '';
        walk(rule.cssRules, cond ? [...conditions, cond] : conditions);
      } else if (rule.selectorText) {
        for (const w of wanted) {
          if (rule.selectorText.includes(w) || rule.cssText.includes(w)) {
            found.push({ selector: rule.selectorText.slice(0, 90), conditions, decl: rule.cssText.slice(rule.selectorText.length, rule.selectorText.length + 110) });
          }
        }
      }
    }
  };
  for (const sheet of document.styleSheets) {
    try { walk(sheet.cssRules, []); } catch { /* cross-origin */ }
  }
  return found;
});

const interesting = out.filter((r) =>
  /is-engine-embed|fp-quality-badge|:not\(\.is-fullscreen\)/.test(r.selector) ||
  /native-bar-h/.test(r.decl)
);
for (const r of interesting) {
  console.log(`conditions=${JSON.stringify(r.conditions)}\n  ${r.selector}\n  ${r.decl.replace(/\s+/g, ' ').slice(0, 110)}\n`);
}
console.log('total matched rules: ' + out.length);
await browser.close();
