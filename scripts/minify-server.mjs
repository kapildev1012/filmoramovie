// Post-build: minify the Cloudflare Worker (SSR) bundle in place.
//
// Astro does NOT minify the server build (vite.build.minify only affects the
// client environment), so the Worker shipped as fully readable library code
// (three.js, hls.js, ...). That unminified code tripped a Cloudflare WAF
// managed-rule false-positive on `wrangler deploy`:
//   POST .../workers/scripts/<name>/versions -> 403 "Attention Required".
// Minifying removes the readable token/whitespace patterns the WAF flags and
// shrinks the upload. `wrangler.json` uses no_bundle, so these files are
// uploaded as-is — minifying them in place is exactly what gets shipped.
//
// Runs with --bundle OFF so import/export graph between chunks is preserved;
// esbuild never renames imported/exported names, only file-local identifiers.

import { build } from 'esbuild';
import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = new URL('../dist/server/', import.meta.url).pathname;

async function walk(dir) {
  const out = [];
  for (const name of await readdir(dir)) {
    const p = join(dir, name);
    const s = await stat(p);
    if (s.isDirectory()) out.push(...(await walk(p)));
    else if (name.endsWith('.mjs') || name.endsWith('.js')) out.push(p);
  }
  return out;
}

const files = await walk(ROOT);
let before = 0;
let after = 0;

for (const file of files) {
  const src = await readFile(file, 'utf8');
  before += Buffer.byteLength(src);
  const res = await build({
    stdin: { contents: src, resolveDir: ROOT, sourcefile: file, loader: 'js' },
    write: false,
    bundle: false,      // keep cross-chunk imports intact
    minify: true,
    format: 'esm',
    platform: 'neutral',
    legalComments: 'none',
    logLevel: 'silent',
  });
  const outText = res.outputFiles[0].text;
  await writeFile(file, outText);
  after += Buffer.byteLength(outText);
}

const pct = ((1 - after / before) * 100).toFixed(1);
console.log(
  `minify-server: ${files.length} files, ${(before / 1024).toFixed(0)} KiB -> ${(after / 1024).toFixed(0)} KiB (-${pct}%)`
);
