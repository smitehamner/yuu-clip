// Ported from tests/ui/test_ui_namecorrections.py - drives the real openNameCorrections
// -> PanelNav.open -> fetch(scan) -> render chain against the seeded DOM, mocking only
// fetch. The panel-open() Playwright poke retires with this file; DOM/CSS-only assertions
// (breadcrumb text, checkbox state, chip text) work identically under happy-dom.
import { AppState } from '../../../yuu_clip/web/static/core/state.js';

vi.mock('../../../yuu_clip/web/static/analyze/transcript.js', async (importActual) => {
  const actual = await importActual();
  return { ...actual, reloadVideoTranscriptIfOpen: vi.fn() };
});
vi.mock('../../../yuu_clip/web/static/clips/clips.js', async (importActual) => {
  const actual = await importActual();
  return { ...actual, refreshClipDetail: vi.fn() };
});
vi.mock('../../../yuu_clip/web/static/core/utils.js', async (importActual) => {
  const actual = await importActual();
  return { ...actual, showToast: vi.fn() };
});

import { showToast } from '../../../yuu_clip/web/static/core/utils.js';
import { openNameCorrections } from '../../../yuu_clip/web/static/people/namecorrections.js';

const VIDEO_ID = 42;

const SCAN = {
  lexicon: ['Yuu', 'Mara'],
  scanned_segments: 3,
  groups: [{
    token: 'You', suggested: 'Yuu', count: 2,
    instances: [
      { segment_id: 11, token: 'You', token_start: 0, token_end: 3,
        score: 66.7, speaker_scoped: true, common_word: true, speaker: 'Mara',
        before: 'warm up first', line: 'You were amazing there', after: 'then it ended' },
      { segment_id: 12, token: 'You', token_start: 8, token_end: 11,
        score: 66.7, speaker_scoped: false, common_word: true, speaker: null,
        before: '', line: 'I think You won it', after: '' },
    ],
  }],
};

const EMPTY = { lexicon: ['Yuu'], scanned_segments: 5, groups: [] };

function stubScan(payload) {
  vi.stubGlobal('fetch', vi.fn((url) => {
    if (String(url).includes('/name-corrections/scan')) {
      return Promise.resolve({ ok: true, json: async () => payload });
    }
    return Promise.reject(new Error(`unexpected fetch: ${url}`));
  }));
}

async function openPanel(payload = SCAN) {
  stubScan(payload);
  openNameCorrections(VIDEO_ID);
  await vi.waitFor(() => {
    expect(document.getElementById('nc-results').textContent).not.toContain('Scanning');
  });
}

beforeEach(() => {
  AppState.activeClipId = null;
});

describe('openNameCorrections', () => {
  it('opens with grouped results', async () => {
    await openPanel();
    expect(document.getElementById('panelnav-breadcrumb').textContent).toContain('Fix names');
    expect(document.querySelectorAll('.nc-group')).toHaveLength(1);
    expect(document.querySelector('.nc-from').textContent).toBe('You');
    expect(document.querySelector('.nc-to').textContent).toBe('Yuu');
    expect(document.querySelectorAll('.nc-instance')).toHaveLength(2);
  });

  it('highlights the matched token', async () => {
    await openPanel();
    const marks = document.querySelectorAll('.nc-mark');
    expect(marks).toHaveLength(2);
    expect(marks[0].textContent).toBe('You');
  });

  it('shows a speaker-unknown chip for an unattributed instance', async () => {
    await openPanel();
    const chips = [...document.querySelectorAll('.nc-chip')].map(c => c.textContent);
    expect(chips.filter(t => t === 'speaker unknown')).toHaveLength(1);
    expect(chips.filter(t => t === 'Mara')).toHaveLength(1);
  });

  it('group select-all toggles every instance and disables Apply', async () => {
    await openPanel();
    const boxes = document.querySelectorAll('.nc-inst');
    expect(boxes[0].checked).toBe(true);
    const groupAll = document.querySelector('.nc-group-all');
    groupAll.checked = false;
    groupAll.dispatchEvent(new Event('change', { bubbles: true }));
    expect(boxes[0].checked).toBe(false);
    expect(boxes[1].checked).toBe(false);
    expect(document.getElementById('nc-apply').disabled).toBe(true);
  });

  it('apply sends only the checked instances', async () => {
    await openPanel();
    const boxes = document.querySelectorAll('.nc-inst');
    boxes[1].checked = false;
    boxes[1].dispatchEvent(new Event('change', { bubbles: true }));
    expect(document.getElementById('nc-apply').textContent).toBe('Apply 1 correction');

    let applyBody = null;
    const fetchMock = vi.fn((url, opts) => {
      if (String(url).includes('/name-corrections/apply')) {
        applyBody = JSON.parse(opts.body);
        return Promise.resolve({
          ok: true,
          json: async () => ({ applied: 1, results: [{ applied: true }], affected_clip_ids: [] }),
        });
      }
      if (String(url).includes('/name-corrections/scan')) {
        return Promise.resolve({ ok: true, json: async () => EMPTY });
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);

    document.getElementById('nc-apply').click();
    await vi.waitFor(() => expect(showToast).toHaveBeenCalled());

    expect(applyBody.corrections).toHaveLength(1);
    expect(applyBody.corrections[0].segment_id).toBe(11);
    expect(applyBody.corrections[0].replacement).toBe('Yuu');
    expect(showToast).toHaveBeenCalledWith('Applied 1 correction', 'success');
  });

  it('shows a clean message for an empty scan', async () => {
    await openPanel(EMPTY);
    expect(document.getElementById('nc-results').textContent).toContain('No likely name corrections');
    expect(document.getElementById('nc-footer').hidden).toBe(true);
  });
});
