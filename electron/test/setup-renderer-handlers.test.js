'use strict';

// Regression guard: the setup wizard renderer is bundled into an IIFE
// (electron/setup.bundle.js). Inline on*= handlers in innerHTML strings are broken
// there - they resolve against window (module functions are not global), and esbuild
// even tree-shakes any function referenced only from such a string literal, so the
// button does nothing. Every injected button must use a data-* attribute driven by the
// delegated document click listener instead. This test fails if an inline handler
// creeps back in.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'setup-renderer.js'), 'utf8');

test('setup-renderer.js has no inline on*= handlers (broken once bundled)', () => {
  const matches = SRC.match(/on(click|change|input|submit|blur|focus|mousedown|keydown)\s*=/gi) || [];
  assert.deepEqual(matches, [], `inline handlers must use event delegation instead: ${matches.join(', ')}`);
});

test('every data-action injected by a button has a delegated branch', () => {
  const actions = [...SRC.matchAll(/data-action="([^"]+)"/g)].map(m => m[1]);
  assert.ok(actions.length > 0, 'expected at least one data-action button');
  for (const action of actions) {
    assert.ok(
      SRC.includes(`=== '${action}'`) || SRC.includes(`=== "${action}"`),
      `data-action "${action}" has no matching delegated handler branch`
    );
  }
});
