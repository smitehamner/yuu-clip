'use strict';

// Turns a failed pip install into plain-English guidance for the setup wizard.
// pip's own exit is just "Exited with code N"; the useful signal is in stderr.
// Telling a user to "check your internet connection" when the real problem is a
// missing wheel or a build error just makes them retry a doomed install (this
// happened on 2026-07-05), so a genuine network failure gets the connection
// hint and everything else gets an honest next step.

const NETWORK_HINTS = [
  'getaddrinfo', 'timed out', 'timeout', 'network is unreachable',
  'temporary failure', 'failed to establish', 'connectionerror',
  'newconnectionerror', 'could not resolve', 'name resolution',
  'connection reset', 'connection refused', 'proxy', 'ssl',
];

function looksLikeNetworkError(stderr) {
  const text = String(stderr || '').toLowerCase();
  return NETWORK_HINTS.some(hint => text.includes(hint));
}

// Returns the sentence the wizard shows after "Install failed: ".
function describeInstallFailure(stderr) {
  if (looksLikeNetworkError(stderr)) {
    return 'the download was interrupted. Check your internet connection, then try again.';
  }
  return 'the install didn’t finish. You can try again, switch to Ollama, or open the setup log and send it to us.';
}

module.exports = { looksLikeNetworkError, describeInstallFailure };
