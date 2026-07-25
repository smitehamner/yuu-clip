'use strict';

// Guard for shell.openExternal. The renderer is our own local content, but a URL
// can reach it from untrusted project data (a video title, a transcript), and
// shell.openExternal will happily invoke file:// or any other registered OS URL
// handler. Restrict it to http/https so a hostile string cannot launch anything
// but a normal web link.
function isExternalUrlAllowed(url) {
  if (typeof url !== 'string') return false;
  let parsed;
  try {
    parsed = new URL(url);
  } catch (_) {
    return false;
  }
  return parsed.protocol === 'http:' || parsed.protocol === 'https:';
}

module.exports = { isExternalUrlAllowed };
