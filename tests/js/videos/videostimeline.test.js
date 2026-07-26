// _renderTimelineHTML / _timelineEmptyNoteHTML / generateTimeline / closeTimelineIntervalModal /
// initVideosTimelineListeners (static/videos/videos-timeline.js) - the pure render helpers and
// the interval-modal open/close/wiring flow. The SSE-driven generation itself
// (confirmGenerateTimeline / _startGenerateTimeline) isn't exported and stays exercised via
// tests/ui/test_ui_video.py. Flagged as a zero-coverage gap in REVIEW_OPEN_ITEMS.md (Section 8).
import { AppState } from '../../../yuu_clip/web/static/core/state.js';
import {
  _renderTimelineHTML, _timelineEmptyNoteHTML, generateTimeline, closeTimelineIntervalModal,
  initVideosTimelineListeners,
} from '../../../yuu_clip/web/static/videos/videos-timeline.js';

const modal = () => document.getElementById('timeline-interval-modal');
const intervalValue = () => document.getElementById('timeline-interval-value');
const intervalUnit = () => document.getElementById('timeline-interval-unit');

beforeEach(() => {
  AppState.videos = [];
  globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));
});

afterEach(() => { delete globalThis.fetch; });

describe('_renderTimelineHTML', () => {
  it('renders nothing for an empty or missing entry list', () => {
    expect(_renderTimelineHTML([])).toBe('');
    expect(_renderTimelineHTML(null)).toBe('');
  });

  it('renders one escaped row per entry with its timestamp', () => {
    const html = _renderTimelineHTML([
      { start_hms: '00:01:00', text: 'A <script>' },
      { start_hms: '00:02:00', text: 'B & C' },
    ]);
    expect(html).toContain('<div class="timeline">');
    expect(html).toContain('00:01:00');
    expect(html).toContain('A &lt;script&gt;');
    expect(html).toContain('B &amp; C');
    expect(html.match(/timeline-entry/g)).toHaveLength(2);
  });
});

describe('_timelineEmptyNoteHTML', () => {
  it('describes the empty state', () => {
    expect(_timelineEmptyNoteHTML()).toContain('No timeline yet');
  });
});

describe('generateTimeline', () => {
  it('loads the saved interval from /api/config into the modal fields and opens it', async () => {
    AppState.videos = [{ id: 5, duration_ms: 600000 }];
    globalThis.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ ui_timeline_interval_seconds: 120, ui_timeline_interval_unit: 'seconds' }),
    }));
    generateTimeline(5);
    await vi.waitFor(() => expect(modal().classList.contains('visible')).toBe(true));
    expect(fetch).toHaveBeenCalledWith('/api/config');
    expect(intervalValue().value).toBe('120');
    expect(intervalUnit().value).toBe('seconds');
  });

  it('overwrites a stale field value with the config default (900s/minutes) when unset', async () => {
    AppState.videos = [{ id: 5 }];
    intervalValue().value = '99';
    generateTimeline(5);
    await vi.waitFor(() => expect(modal().classList.contains('visible')).toBe(true));
    expect(intervalValue().value).toBe('15');
    expect(intervalUnit().value).toBe('minutes');
  });

  it('still opens the modal when the config fetch rejects', async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('network down')));
    AppState.videos = [{ id: 5 }];
    generateTimeline(5);
    await vi.waitFor(() => expect(modal().classList.contains('visible')).toBe(true));
  });

  it('shows an entry-count hint scaled to the recording duration', async () => {
    AppState.videos = [{ id: 5, duration_ms: 30 * 60 * 1000 }]; // 30 min, default 15-min interval
    generateTimeline(5);
    await vi.waitFor(() => expect(modal().classList.contains('visible')).toBe(true));
    expect(document.getElementById('timeline-interval-hint').textContent).toContain('~2 entries');
  });
});

describe('closeTimelineIntervalModal', () => {
  it('hides the modal and restores focus to the element that opened it', async () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    AppState.videos = [{ id: 5 }];
    generateTimeline(5);
    await vi.waitFor(() => expect(modal().classList.contains('visible')).toBe(true));

    closeTimelineIntervalModal();

    expect(modal().classList.contains('visible')).toBe(false);
    expect(document.activeElement).toBe(opener);
  });
});

describe('initVideosTimelineListeners', () => {
  beforeEach(() => initVideosTimelineListeners());

  it('closes the modal when the Cancel button is clicked', async () => {
    AppState.videos = [{ id: 5 }];
    generateTimeline(5);
    await vi.waitFor(() => expect(modal().classList.contains('visible')).toBe(true));

    document.getElementById('timeline-interval-cancel-btn').click();

    expect(modal().classList.contains('visible')).toBe(false);
  });

  it('closes the modal on a background click but not a click inside the dialog', async () => {
    AppState.videos = [{ id: 5 }];
    generateTimeline(5);
    await vi.waitFor(() => expect(modal().classList.contains('visible')).toBe(true));

    modal().querySelector('.modal').click();
    expect(modal().classList.contains('visible')).toBe(true);

    modal().click();
    expect(modal().classList.contains('visible')).toBe(false);
  });

  it('re-scales the entry-count hint (and disables Generate) as the interval value changes', async () => {
    AppState.videos = [{ id: 5, duration_ms: 60 * 60 * 1000 }];
    generateTimeline(5);
    await vi.waitFor(() => expect(modal().classList.contains('visible')).toBe(true));
    const genBtn = document.getElementById('timeline-interval-generate-btn');
    expect(genBtn.disabled).toBe(false);

    intervalUnit().value = 'seconds';
    intervalValue().value = '5';
    intervalValue().dispatchEvent(new Event('input'));

    expect(document.getElementById('timeline-interval-hint').textContent).toBe(
      'Minimum interval is 10 seconds.',
    );
    expect(genBtn.disabled).toBe(true);
  });
});
