// renderEstimate (static/analyze/analyze.js) - the New Recording panel's time-
// estimate render. Ported from the render-assertion cases in
// tests/ui/test_ui_analyze.py::TestEstimateDisplay: renderEstimate writes into the
// static #estimate-area, so happy-dom can drive it directly with controlled data,
// no live probe. Only the "empty until a probe runs" open-flow case stays in
// Playwright.
import { AppState } from '../../../yuu_clip/web/static/core/state.js';
import { renderEstimate } from '../../../yuu_clip/web/static/analyze/analyze.js';

const MOCK_INFO = {
  filename: 'test.mkv', duration_hms: '1h 00m', duration_s: 3600,
  width: 1920, height: 1080, fps: 60, audio_tracks: 2,
};

const ENERGY = {
  none: ['Audio energy (none)', 0, 'skipped', '0s'],
  fast: ['Audio energy (fast)', 14.4, '4 kHz numpy', '14s'],
  full: ['Audio energy (full)', 36.0, '16 kHz numpy', '36s'],
};

function makeSteps(energyMode = 'fast') {
  const [name, seconds, note, hms] = ENERGY[energyMode];
  return [
    { name: 'Extract audio', seconds: 360, note: '2 tracks', hms: '6m 00s' },
    { name: 'Transcribe (medium)', seconds: 200, note: '1 track on GPU', hms: '3m 20s' },
    { name, seconds, note, hms },
    { name: 'Scene cut detection (fast)', seconds: 18, note: 'keyframes + transcript gaps', hms: '18s' },
    { name: 'LLM scoring', seconds: 80, note: '~20 clips estimated', hms: '1m 20s' },
  ];
}

function injectEstimate({
  energyMode = 'fast', pct = 18.7, source = 'estimated',
  longRunWarning = false, warnHours = 2.0,
} = {}) {
  const steps = makeSteps(energyMode);
  renderEstimate(MOCK_INFO, {
    steps,
    total_hms: '11m 12s',
    total_seconds: steps.reduce((a, s) => a + s.seconds, 0),
    pct_of_video: pct,
    source,
    long_run_warning: longRunWarning,
    warn_hours: warnHours,
  });
}

const area = () => document.getElementById('estimate-area');

describe('renderEstimate - energy step name', () => {
  it('shows the fast energy mode name', () => {
    injectEstimate({ energyMode: 'fast' });
    expect(area().textContent).toContain('Audio energy (fast)');
  });
  it('shows the none mode as skipped', () => {
    injectEstimate({ energyMode: 'none' });
    expect(area().textContent).toContain('Audio energy (none)');
    expect(area().textContent).toContain('skipped');
  });
  it('shows the full energy mode name', () => {
    injectEstimate({ energyMode: 'full' });
    expect(area().textContent).toContain('Audio energy (full)');
  });
});

describe('renderEstimate - percent of recording', () => {
  it('renders the percent line', () => {
    injectEstimate({ pct: 18.7 });
    const pct = area().querySelector('.estimate-pct');
    expect(pct).not.toBeNull();
    expect(pct.textContent).toContain('18.7%');
  });
  it('labels the percent as of recording duration', () => {
    injectEstimate({ pct: 96.0 });
    const pct = area().querySelector('.estimate-pct');
    expect(pct.textContent).toContain('96.0%');
    expect(pct.textContent).toContain('of recording');
  });
});

describe('renderEstimate - source caption', () => {
  it('an estimated source reads as a rough estimate', () => {
    injectEstimate({ source: 'estimated' });
    expect(area().querySelector('.estimate-source').textContent).toContain('Rough estimate');
  });
  it('a measured source reads as based on your last runs', () => {
    injectEstimate({ source: 'measured' });
    expect(area().querySelector('.estimate-source').textContent).toContain('Based on your last runs');
  });
});

describe('renderEstimate - long-run warning', () => {
  it('is absent below the threshold', () => {
    injectEstimate({ longRunWarning: false });
    expect(area().querySelectorAll('.long-run-warning')).toHaveLength(0);
  });
  it('warns about splitting above the threshold', () => {
    injectEstimate({ longRunWarning: true, warnHours: 2.0 });
    const warning = area().querySelector('.long-run-warning');
    expect(warning).not.toBeNull();
    expect(warning.textContent).toContain('splitting');
  });
});

describe('estimate area placement (static markup)', () => {
  it('follows the Advanced Options details block in the DOM', () => {
    const details = document.querySelector('details.advanced');
    const following = details.compareDocumentPosition(area()) & Node.DOCUMENT_POSITION_FOLLOWING;
    expect(following).not.toBe(0);
  });
});

afterEach(() => { AppState.lastEstimateSteps = undefined; });
