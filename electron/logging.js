'use strict';

// Setup/install log file handling for the desktop wrapper, split out of main.js.
// Rotates a small ring of files and writes a BOM on fresh logs so PowerShell 5.1
// doesn't mis-decode the em-dashes our copy uses.

const fs   = require('fs');
const path = require('path');
const { SETUP_LOG } = require('./constants');

const MAX_LOG_FILES = 5;

// Strip the account-name segment from home paths (\Users\<name>, /Users/<name>,
// /home/<name>) so a shared log doesn't leak the user's OS username. Everything
// after the name (the app subpaths) is kept so the log stays diagnosable.
function redactPaths(text) {
  return String(text)
    .replace(/([A-Za-z]:[\\/]Users[\\/])([^\\/\s"'<>|)]+)/gi, '$1<user>')
    .replace(/(\/(?:home|Users)\/)([^/\s"'<>|)]+)/g, '$1<user>');
}

function rotateLogs() {
  const dir = path.dirname(SETUP_LOG);
  fs.mkdirSync(dir, { recursive: true });
  try {
    const oldest = `${SETUP_LOG}.${MAX_LOG_FILES - 1}`;
    if (fs.existsSync(oldest)) fs.unlinkSync(oldest);
    for (let i = MAX_LOG_FILES - 2; i >= 1; i--) {
      const src = `${SETUP_LOG}.${i}`;
      if (fs.existsSync(src)) fs.renameSync(src, `${SETUP_LOG}.${i + 1}`);
    }
    if (fs.existsSync(SETUP_LOG)) fs.renameSync(SETUP_LOG, `${SETUP_LOG}.1`);
  } catch (_) {}
}

function logSetup(msg) {
  fs.mkdirSync(path.dirname(SETUP_LOG), { recursive: true });
  // Write a UTF-8 BOM when starting a fresh log (first line, or first after a
  // rotation) so PowerShell 5.1 / ANSI-default tools don't decode non-ASCII
  // characters our copy uses (arrows, checkmarks) as cp1252 mojibake.
  if (!fs.existsSync(SETUP_LOG)) fs.writeFileSync(SETUP_LOG, '﻿');
  fs.appendFileSync(SETUP_LOG, `[${new Date().toISOString()}] ${redactPaths(msg)}\n`);
}

module.exports = { rotateLogs, logSetup, redactPaths };
