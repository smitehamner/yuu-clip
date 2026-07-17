// esbuild driver for the web UI's ESM bundle. Bundles the module graph rooted
// at yuu_clip/web/static/main.esm.js into static/bundle.esm.js.
//
// This is the ONLY place esbuild's flags live, so `yuu-dev bundle` (which shells
// out to `node scripts/build-esm.mjs`) and the drift guard produce identical
// output. Output must be deterministic given a pinned esbuild version: the inline
// sourcemap's `sources` are emitted relative to the outfile's directory, so the
// drift check writes its comparison copy into the same static/ dir to stay
// byte-for-byte identical.
//
//   node scripts/build-esm.mjs                 -> writes static/bundle.esm.js
//   node scripts/build-esm.mjs --outfile PATH  -> writes PATH instead (drift check)
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(scriptDir);
const staticDir = join(repoRoot, 'yuu_clip', 'web', 'static');

const outfileIdx = process.argv.indexOf('--outfile');
const outfile = outfileIdx >= 0 ? process.argv[outfileIdx + 1] : join(staticDir, 'bundle.esm.js');

await build({
  entryPoints: [join(staticDir, 'main.esm.js')],
  outfile,
  bundle: true,
  format: 'iife',
  target: ['es2020'],
  charset: 'utf8',
  legalComments: 'none',
  sourcemap: 'inline',
  sourcesContent: true,
  logLevel: outfileIdx >= 0 ? 'silent' : 'info',
});
