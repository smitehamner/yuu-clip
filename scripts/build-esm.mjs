// esbuild driver for the committed ESM bundles. Two entries:
//   web    - yuu_clip/web/static/main.esm.js  -> static/bundle.esm.js   (the whole app)
//   wizard - electron/setup-renderer.js       -> electron/setup.bundle.js (setup wizard)
//
// This is the ONLY place esbuild's flags live, so `yuu-dev bundle` (which shells out to
// `node scripts/build-esm.mjs`) and the drift guards produce identical output. Output
// must be deterministic given a pinned esbuild version: the inline sourcemap's `sources`
// are emitted relative to the outfile's directory, so a drift check must write its
// comparison copy into the SAME directory as the real artifact to stay byte-for-byte
// identical.
//
//   node scripts/build-esm.mjs                              -> writes both bundles
//   node scripts/build-esm.mjs --target web --outfile PATH  -> writes only web to PATH
//   node scripts/build-esm.mjs --target wizard --outfile PATH -> writes only wizard to PATH
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(scriptDir);
const staticDir = join(repoRoot, 'yuu_clip', 'web', 'static');
const electronDir = join(repoRoot, 'electron');

const TARGETS = {
  web: {
    entry: join(staticDir, 'main.esm.js'),
    outfile: join(staticDir, 'bundle.esm.js'),
  },
  wizard: {
    entry: join(electronDir, 'setup-renderer.js'),
    outfile: join(electronDir, 'setup.bundle.js'),
  },
};

const targetIdx = process.argv.indexOf('--target');
const outfileIdx = process.argv.indexOf('--outfile');
const only = targetIdx >= 0 ? process.argv[targetIdx + 1] : null;
const outfileOverride = outfileIdx >= 0 ? process.argv[outfileIdx + 1] : null;
const silent = outfileOverride !== null;

if (outfileOverride !== null && !only) {
  throw new Error('--outfile requires --target web|wizard (it writes a single entry)');
}

const selected = only ? [only] : Object.keys(TARGETS);

for (const name of selected) {
  const target = TARGETS[name];
  if (!target) throw new Error(`unknown --target ${name} (expected web or wizard)`);
  await build({
    entryPoints: [target.entry],
    outfile: outfileOverride || target.outfile,
    bundle: true,
    format: 'iife',
    target: ['es2020'],
    charset: 'utf8',
    legalComments: 'none',
    sourcemap: 'inline',
    sourcesContent: true,
    logLevel: silent ? 'silent' : 'info',
  });
}
