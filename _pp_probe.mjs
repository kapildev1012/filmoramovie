import { getPlatformProxy } from 'wrangler';

process.stdout.write('STEP: calling getPlatformProxy...\n');
const t = setTimeout(() => {
  process.stdout.write('RESULT: STILL HANGING after 40s\n');
  process.exit(2);
}, 40000);

try {
  const proxy = await getPlatformProxy();
  clearTimeout(t);
  process.stdout.write('RESULT: OK env=' + JSON.stringify(Object.keys(proxy.env || {})) + '\n');
  await proxy.dispose();
  process.exit(0);
} catch (e) {
  clearTimeout(t);
  process.stdout.write('RESULT: ERROR ' + (e && e.stack ? e.stack : String(e)) + '\n');
  process.exit(1);
}
