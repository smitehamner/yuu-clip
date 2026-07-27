// Global uncaught-error surface. Without this, a client-side ReferenceError or a
// throw on a rarely-hit path fails silently in the browser - exactly the class
// that shipped in the window.X shim drain (an Escape handler calling a drained
// global). We surface every uncaught error and unhandled promise rejection three
// ways: the devtools console (for a developer), a log-panel line the non-technical
// user can open and copy into a bug report, and a persistent error toast pointing
// them at that log. Wired once from boot.js via initGlobalErrorReporter().
import { showToast, appendLog, openLog } from './utils.js';

const _DUP_TOAST_WINDOW_MS = 5000;
let _lastToastSignature = '';
let _lastToastAt = 0;

function _report(label, message, stack) {
  const detail = message || 'Unknown error';
  console.error(`[${label}]`, stack || detail);
  appendLog(`[${label}] Error: ${detail}`, true);
  const signature = `${label}:${detail}`;
  const now = Date.now();
  // A looping error (e.g. thrown every render) would otherwise stack identical
  // toasts - log every occurrence but show the toast at most once per window.
  if (signature === _lastToastSignature && now - _lastToastAt < _DUP_TOAST_WINDOW_MS) return;
  _lastToastSignature = signature;
  _lastToastAt = now;
  showToast(
    'Something went wrong. Open the log panel to copy the details for a bug report.',
    'error',
    { action: { label: 'Show log', onClick: openLog } },
  );
}

export function initGlobalErrorReporter() {
  window.addEventListener('error', (event) => {
    _report('Uncaught', event.message, event.error && event.error.stack);
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message = reason && reason.message ? reason.message : String(reason);
    _report('Unhandled rejection', message, reason && reason.stack);
  });
}
