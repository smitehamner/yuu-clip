'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pkg = require('../package.json');
const installerNsh = fs.readFileSync(path.join(__dirname, '..', 'installer.nsh'), 'utf8');

// The desktop shortcut is opt-out via a wizard checkbox. That only works if
// electron-builder's built-in shortcut is OFF and we create it ourselves in
// customInstall, gated on the checkbox. If createDesktopShortcut were flipped
// back to true, the built-in would create it unconditionally and the checkbox
// would become a silent no-op.
test('electron-builder does not create the desktop shortcut itself', () => {
  assert.equal(pkg.build.nsis.createDesktopShortcut, false);
});

test('installer creates the shortcut only when the checkbox is checked', () => {
  assert.match(installerNsh, /\$\{If\}\s+\$CreateDesktopShortcut == "1"/);
  assert.match(installerNsh, /CreateShortCut "\$newDesktopLink"/);
});

test('uninstaller removes the shortcut we created', () => {
  assert.match(installerNsh, /Delete "\$newDesktopLink"/);
});

test('the choice defaults to creating the shortcut for silent installs', () => {
  assert.match(installerNsh, /StrCpy \$CreateDesktopShortcut "1"/);
});
