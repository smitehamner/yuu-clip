// Feature-map - GitHub update check (notify-only, never downloads/installs anything).
//   On launch (throttled to roughly once a day) and via a manual "Check for
//   updates now" button in Settings, compares the running version to GitHub's
//   latest release tag and offers a link to it.
//   API: GET /api/updates/check, config.update_check_enabled
//   UI: header #update-banner, Settings #s-update-check-status / #btn-check-for-updates
//   Tests: tests/js/core/updatecheck.test.js.

const _THROTTLE_MS = 24 * 60 * 60 * 1000;
const _LAST_CHECK_KEY = 'yuuclip-update-last-checked-at';
const _DISMISSED_VERSION_KEY = 'yuuclip-update-dismissed-version';

async function fetchUpdateStatus() {
  try {
    return await fetch('/api/updates/check').then(r => r.json());
  } catch {
    return { error: 'network error', update_available: false };
  }
}

function updateStatusText(result) {
  if (!result || result.error) return "Couldn't check for updates - try again later";
  if (result.update_available) return `v${result.latest_version} is available`;
  return "You're on the latest version";
}

function renderUpdateBanner(result) {
  const banner = document.getElementById('update-banner');
  const link = document.getElementById('update-banner-link');
  if (!banner || !link) return;
  const dismissed = localStorage.getItem(_DISMISSED_VERSION_KEY);
  if (!result || result.error || !result.update_available || result.latest_version === dismissed) {
    banner.style.display = 'none';
    return;
  }
  banner.dataset.latestVersion = result.latest_version;
  link.textContent = `v${result.latest_version} available`;
  link.href = result.release_url || 'https://github.com/smitehamner/yuu-clip/releases/latest';
  banner.style.display = 'flex';
}

function dismissUpdateBanner() {
  const banner = document.getElementById('update-banner');
  if (!banner) return;
  if (banner.dataset.latestVersion) localStorage.setItem(_DISMISSED_VERSION_KEY, banner.dataset.latestVersion);
  banner.style.display = 'none';
}

// Shared by the launch check, the Settings status line, and the manual
// "Check for updates now" button - always a live network call (bypasses any
// throttle), always keeps the header banner in sync.
async function checkForUpdatesNow() {
  const result = await fetchUpdateStatus();
  localStorage.setItem(_LAST_CHECK_KEY, String(Date.now()));
  renderUpdateBanner(result);
  return result;
}

function _dueForAutoCheck() {
  const last = parseInt(localStorage.getItem(_LAST_CHECK_KEY) || '0', 10);
  return Date.now() - last > _THROTTLE_MS;
}

// Called on launch with the saved config's update_check_enabled - a no-op when
// the user turned automatic checking off, or when checked recently.
async function initUpdateCheckOnLaunch(updateCheckEnabled) {
  if (updateCheckEnabled === false) return;
  if (!_dueForAutoCheck()) return;
  await checkForUpdatesNow();
}

function wireUpdateBanner() {
  document.getElementById('update-banner-dismiss')?.addEventListener('click', dismissUpdateBanner);
}

export {
  fetchUpdateStatus, updateStatusText, renderUpdateBanner, dismissUpdateBanner,
  checkForUpdatesNow, initUpdateCheckOnLaunch, wireUpdateBanner,
};
