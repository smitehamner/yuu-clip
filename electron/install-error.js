'use strict';

// Turns a failed pip/venv install into plain-English guidance for the setup
// wizard and the first-run setup window. pip's own exit is just "Exited with
// code N"; the useful signal is in stderr. A wrong hint (e.g. "check your
// connection" when the real problem is a missing wheel) just makes a
// non-developer retry a doomed install (this happened 2026-07-05), so each
// failure class gets its own honest next step. Order matters: a genuine network
// failure is checked first because its strings can co-occur with the others.

const NETWORK_HINTS = [
  'getaddrinfo', 'timed out', 'timeout', 'network is unreachable',
  'temporary failure', 'failed to establish', 'connectionerror',
  'newconnectionerror', 'could not resolve', 'name resolution',
  'connection reset', 'connection refused', 'proxy', 'ssl',
];

// Out of disk space mid-download or extract.
const DISK_HINTS = [
  'no space left', 'errno 28', 'not enough space', 'disk full',
  'insufficient disk space', 'winerror 112',
];

// A file was blocked or locked - usually antivirus or a file still in use,
// not a bug in the install.
const PERMISSION_HINTS = [
  'access is denied', 'permission denied', 'errno 13', 'winerror 5',
  'winerror 32', 'operation not permitted', 'used by another process',
];

// pip found no wheel for this machine - most often a GPU/CUDA-tagged wheel whose
// tag doesn't match, or a package with no binary for this Python/platform.
const NO_WHEEL_HINTS = [
  'no matching distribution', 'could not find a version',
  'is not a supported wheel', 'none of the wheel',
];

// A CUDA / graphics-driver load failure surfacing during install or first import.
const CUDA_HINTS = [
  'cudart', 'cublas', 'cudnn', 'nvcuda', 'cuda driver', 'cuda error',
];

function hasAny(text, hints) {
  return hints.some(hint => text.includes(hint));
}

function looksLikeNetworkError(stderr) {
  return hasAny(String(stderr || '').toLowerCase(), NETWORK_HINTS);
}

// Returns the sentence the wizard shows after "Install failed: " (and that the
// first-run window folds into its own message). Each sentence starts lowercase
// so it reads as a continuation of that prefix.
function describeInstallFailure(stderr) {
  const text = String(stderr || '').toLowerCase();
  if (hasAny(text, NETWORK_HINTS)) {
    return 'the download was interrupted. Check your internet connection, then try again.';
  }
  if (hasAny(text, DISK_HINTS)) {
    return 'your disk ran out of space. Free up some room, then try again.';
  }
  if (hasAny(text, PERMISSION_HINTS)) {
    return 'a file was blocked - often by antivirus, or because a file was still in use. ' +
           'Allow yuu-clip in your antivirus (or close other apps that might be using it), then try again.';
  }
  if (hasAny(text, NO_WHEEL_HINTS)) {
    return 'the right package for your system wasn’t available. If this was GPU acceleration, ' +
           'you can keep using the CPU instead - or try again.';
  }
  if (hasAny(text, CUDA_HINTS)) {
    return 'GPU acceleration couldn’t load - your graphics driver may be older than the CUDA build. ' +
           'yuu-clip will keep working on the CPU.';
  }
  return 'the install didn’t finish. You can try again, switch to Ollama, or open the setup log and send it to us.';
}

module.exports = { looksLikeNetworkError, describeInstallFailure };
