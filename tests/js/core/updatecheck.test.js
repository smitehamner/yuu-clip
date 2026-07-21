// GitHub update check (static/core/updatecheck.js): launch check (throttled),
// manual re-check, and the dismissible header banner. Never downloads/installs -
// only ever reports a newer version and links to it.
import {
  fetchUpdateStatus, updateStatusText, renderUpdateBanner, dismissUpdateBanner,
  checkForUpdatesNow, initUpdateCheckOnLaunch, wireUpdateBanner,
} from '../../../yuu_clip/web/static/core/updatecheck.js';

beforeEach(() => {
  localStorage.clear();
  document.getElementById('update-banner').style.display = 'none';
  document.getElementById('update-banner').removeAttribute('data-latest-version');
  document.getElementById('update-banner-link').textContent = '';
  document.getElementById('update-banner-link').removeAttribute('href');
});

describe('fetchUpdateStatus', () => {
  it('returns the parsed JSON on success', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      json: () => Promise.resolve({ update_available: true, latest_version: '9.9.9' }),
    })));
    const result = await fetchUpdateStatus();
    expect(result.update_available).toBe(true);
  });

  it('returns an error result instead of throwing on a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
    const result = await fetchUpdateStatus();
    expect(result.error).toBeTruthy();
    expect(result.update_available).toBe(false);
  });
});

describe('updateStatusText', () => {
  it('reports the new version when one is available', () => {
    expect(updateStatusText({ update_available: true, latest_version: '0.2.0' }))
      .toBe('v0.2.0 is available');
  });

  it('reports up to date when none is available', () => {
    expect(updateStatusText({ update_available: false })).toMatch(/latest version/);
  });

  it('reports a failure message when the result carries an error', () => {
    expect(updateStatusText({ error: 'boom' })).toMatch(/Couldn't check/);
  });

  it('reports a failure message for a falsy result', () => {
    expect(updateStatusText(null)).toMatch(/Couldn't check/);
  });
});

describe('renderUpdateBanner', () => {
  it('shows the banner and links to the release when an update is available', () => {
    renderUpdateBanner({ update_available: true, latest_version: '0.2.0', release_url: 'https://example.test/r' });
    const banner = document.getElementById('update-banner');
    const link = document.getElementById('update-banner-link');
    expect(banner.style.display).toBe('flex');
    expect(link.href).toBe('https://example.test/r');
    expect(link.textContent).toContain('0.2.0');
  });

  it('hides the banner when already up to date', () => {
    renderUpdateBanner({ update_available: false });
    expect(document.getElementById('update-banner').style.display).toBe('none');
  });

  it('hides the banner on an error result', () => {
    renderUpdateBanner({ error: 'boom' });
    expect(document.getElementById('update-banner').style.display).toBe('none');
  });

  it('stays hidden for a version already dismissed', () => {
    localStorage.setItem('yuuclip-update-dismissed-version', '0.2.0');
    renderUpdateBanner({ update_available: true, latest_version: '0.2.0', release_url: 'https://example.test/r' });
    expect(document.getElementById('update-banner').style.display).toBe('none');
  });

  it('shows again for a newer version than the one dismissed', () => {
    localStorage.setItem('yuuclip-update-dismissed-version', '0.2.0');
    renderUpdateBanner({ update_available: true, latest_version: '0.3.0', release_url: 'https://example.test/r' });
    expect(document.getElementById('update-banner').style.display).toBe('flex');
  });
});

describe('dismissUpdateBanner', () => {
  it('hides the banner and remembers the dismissed version', () => {
    renderUpdateBanner({ update_available: true, latest_version: '0.2.0', release_url: 'https://example.test/r' });
    dismissUpdateBanner();
    expect(document.getElementById('update-banner').style.display).toBe('none');
    expect(localStorage.getItem('yuuclip-update-dismissed-version')).toBe('0.2.0');
  });
});

describe('checkForUpdatesNow', () => {
  it('fetches, stamps the last-checked time, and renders the banner', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      json: () => Promise.resolve({ update_available: true, latest_version: '0.2.0', release_url: 'https://example.test/r' }),
    })));
    const result = await checkForUpdatesNow();
    expect(result.update_available).toBe(true);
    expect(localStorage.getItem('yuuclip-update-last-checked-at')).toBeTruthy();
    expect(document.getElementById('update-banner').style.display).toBe('flex');
  });
});

describe('initUpdateCheckOnLaunch', () => {
  it('does not check when the user turned automatic checking off', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await initUpdateCheckOnLaunch(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('checks when enabled and no check has ever run', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      json: () => Promise.resolve({ update_available: false }),
    })));
    await initUpdateCheckOnLaunch(true);
    expect(localStorage.getItem('yuuclip-update-last-checked-at')).toBeTruthy();
  });

  it('does not re-check within the throttle window', async () => {
    localStorage.setItem('yuuclip-update-last-checked-at', String(Date.now()));
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await initUpdateCheckOnLaunch(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('checks again once the throttle window has elapsed', async () => {
    const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
    localStorage.setItem('yuuclip-update-last-checked-at', String(twoDaysAgo));
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      json: () => Promise.resolve({ update_available: false }),
    })));
    await initUpdateCheckOnLaunch(true);
    expect(parseInt(localStorage.getItem('yuuclip-update-last-checked-at'), 10)).toBeGreaterThan(twoDaysAgo);
  });
});

describe('wireUpdateBanner', () => {
  it('wires the dismiss button to hide the banner', () => {
    renderUpdateBanner({ update_available: true, latest_version: '0.2.0', release_url: 'https://example.test/r' });
    wireUpdateBanner();
    document.getElementById('update-banner-dismiss').click();
    expect(document.getElementById('update-banner').style.display).toBe('none');
  });
});
