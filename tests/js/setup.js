// Seed happy-dom with the real index.html body before any UI module imports.
//
// Several modules wire load-time listeners in module scope (e.g. utils.js does
// document.getElementById('btn-log-toggle').addEventListener(...) at import), which
// throws on a bare DOM. Injecting index.html's body once - here, before the test
// files (and therefore their module imports) run - reproduces the browser's DOM so
// those imports resolve. innerHTML never executes <script>, so the committed bundle
// tag is inert. beforeEach re-seeds so each test starts from a clean DOM.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { beforeEach } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const indexHtml = readFileSync(
  join(here, '..', '..', 'yuu_clip', 'web', 'static', 'index.html'),
  'utf8',
);
// Strip <script> tags: happy-dom tries to fetch src scripts (the committed bundle)
// and throws when script loading is disabled. We only want the static DOM.
const bodyInner = (indexHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i) || [, ''])[1]
  .replace(/<script[\s\S]*?<\/script>/gi, '');

function seedBody() {
  document.body.innerHTML = bodyInner;
}

seedBody(); // before module imports (load-time getElementById wiring)
beforeEach(seedBody);
