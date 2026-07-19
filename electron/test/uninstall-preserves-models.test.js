'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pkg = require('../package.json');
const installerNsh = fs.readFileSync(path.join(__dirname, '..', 'installer.nsh'), 'utf8');

// An electron-builder upgrade runs the OLD uninstaller silently with --updated
// before installing the new version, and customUnInstall is inserted
// unconditionally. So anything customUnInstall deletes outright is destroyed on
// every upgrade - which is how a user lost their downloaded .gguf model (a ~4.7 GB
// re-download) and got "The set-up local model file is missing" after updating.
// $isDeleteAppData is electron-builder's own real-uninstall-vs-upgrade signal.
function customUnInstallBody() {
  const match = installerNsh.match(/!macro customUnInstall\r?\n([\s\S]*?)!macroend/);
  assert.ok(match, 'installer.nsh must define a customUnInstall macro');
  return match[1];
}

test('the runtime dirs are removed only on a real uninstall, not an upgrade', () => {
  const body = customUnInstallBody();
  const gate = body.match(/\$\{if\}\s+\$isDeleteAppData == "1"([\s\S]*?)\$\{endif\}/i);
  assert.ok(gate, 'runtime-dir removal must be gated on $isDeleteAppData');

  const removals = body.match(/RMDir\s+\/r\s+"[^"]+"/g) || [];
  assert.deepEqual(
    removals,
    gate[1].match(/RMDir\s+\/r\s+"[^"]+"/g) || [],
    'every recursive removal must sit inside the $isDeleteAppData gate'
  );
});

test('a full uninstall still clears the models and updater dirs', () => {
  const body = customUnInstallBody();
  assert.match(body, /RMDir \/r "\$LOCALAPPDATA\\yuu-clip"/);
  assert.match(body, /RMDir \/r "\$LOCALAPPDATA\\yuu-clip-updater"/);
});

// $isDeleteAppData is only set to "1" on a non-updated uninstall when
// DELETE_APP_DATA_ON_UNINSTALL is defined. Turning this off would leave the gate
// permanently closed and the runtime dirs would survive a real uninstall.
test('deleteAppDataOnUninstall stays on so the gate can ever open', () => {
  assert.equal(pkg.build.nsis.deleteAppDataOnUninstall, true);
});
