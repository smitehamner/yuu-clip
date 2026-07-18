// renderVideoDetail (static/videos/videos.js) - the video-detail card layout and
// the run-timing provenance line. Ported from tests/ui/test_ui_video.py
// (TestVideoDetailCardLayout, TestRunTimingProvenanceLine): both classes only call
// renderVideoDetail(video, null) and read the built #detail DOM, so they run
// browserless here. setupRecordingPreview (wires a real <video>) is mocked to a
// no-op; the timeline/speaker seams videos.js reads as window.* are stubbed, while
// the run-meta functions actually under test (_runTimingLine, _renderRunMetaCard)
// stay real.
import { AppState } from '../../../yuu_clip/web/static/core/state.js';

vi.mock('../../../yuu_clip/web/static/core/preview.js', async (importActual) => {
  const actual = await importActual();
  return { ...actual, setupRecordingPreview: vi.fn() };
});

import { renderVideoDetail } from '../../../yuu_clip/web/static/videos/videos.js';
import {
  _renderRunMetaCard, _runTimingLine,
} from '../../../yuu_clip/web/static/videos/videos-runmeta.js';

const MID = '·'; // middot separator the timing line joins stages with

const MOCK_ANALYZE_RUN = {
  started_at: '2026-06-01T00:00:00+00:00',
  finished_at: '2026-06-01T00:04:12+00:00',
  elapsed_ms: 252000,
  device: { has_gpu: false },
  settings: {},
  stages: [
    { name: 'extract', seconds: 12 },
    { name: 'transcribe', seconds: 181 },
    { name: 'speakers', seconds: 38 },
    { name: 'score', seconds: 41 },
  ],
};

function baseVideo(overrides = {}) {
  return Object.assign({
    id: 1,
    title: 'My Session',
    filename: 'session.mkv',
    title_is_edited: false,
    duration_hms: '1:02:03',
    clip_count: 5,
    total_clip_ms: 300000,
    summary: null,
    summary_is_edited: false,
    status: 'done',
    has_timeline: false,
    context_names: [],
    clips_scored_at: null,
    clips_scored_context: [],
    clips_llm_error: 0,
    analyze_run: null,
    source_url: null,
  }, overrides);
}

const render = (overrides = {}) => renderVideoDetail(baseVideo(overrides), null);
const detail = () => document.getElementById('detail');
const cards = () => [...detail().querySelectorAll('.detail-card')];
const cardWith = (text) => cards().filter((c) => c.textContent.includes(text));

beforeEach(() => {
  AppState.contexts = [];
  AppState.canReveal = false;
  AppState.analyzeFilename = null;
  AppState.activeVideoId = null;
  window._renderRunMetaCard = _renderRunMetaCard;
  window._runTimingLine = _runTimingLine;
  window._renderTimelineHTML = () => '';
  window._timelineEmptyNoteHTML = () => '';
  // has_timeline true triggers a background fetch(/api/videos/:id); stub it so the
  // synchronous render assertions never touch a real endpoint.
  globalThis.fetch = vi.fn(() => Promise.resolve({ json: () => Promise.resolve({}) }));
});

afterEach(() => { delete globalThis.fetch; });

describe('renderVideoDetail card layout', () => {
  it('summary card renders the Generate Summary button when empty', () => {
    render({ summary: null });
    const card = cardWith('Session Summary');
    expect(card).toHaveLength(1);
    expect(card[0].querySelector('#btn-summarize-video').textContent).toBe('Generate Summary');
  });

  it('summary card shows its content and a kebab when present', () => {
    render({ summary: 'A great session happened.' });
    const card = cardWith('Session Summary');
    expect(card[0].textContent).toContain('A great session happened.');
    expect(card[0].querySelectorAll('.kebab-btn')).toHaveLength(1);
  });

  it('timeline card renders the Generate Timeline button when empty', () => {
    render({ has_timeline: false });
    const card = cardWith('Session Timeline');
    expect(card).toHaveLength(1);
    expect(card[0].querySelector('#btn-generate-timeline').textContent).toBe('Generate Timeline');
  });

  it('timeline card button says Regenerate when a timeline exists', () => {
    render({ has_timeline: true });
    const card = cardWith('Session Timeline');
    expect(card[0].querySelector('#btn-generate-timeline').textContent).toBe('Regenerate Timeline');
  });

  it('World Contexts is its own card, outside the title card', () => {
    render({});
    expect(cards()[0].textContent).not.toContain('World Contexts');
    const ctxCard = cards().filter((c) => c.querySelector('.context-chips'));
    expect(ctxCard).toHaveLength(1);
    expect(ctxCard[0].querySelector('.detail-card-title').textContent).toBe('World Contexts');
  });

  it('the title kebab renders even when no title exists', () => {
    render({ title: null });
    expect(cards()[0].querySelectorAll('.kebab-btn')).toHaveLength(1);
  });

  it('the meta line sits under the title inside the title card', () => {
    render({});
    expect(cards()[0].textContent).toContain('clipped');
  });

  it('the actions row keeps only Export Approved and Additional Actions', () => {
    render({});
    const buttons = detail().querySelectorAll('.vid-actions button');
    expect(buttons).toHaveLength(2);
    expect(buttons[0].textContent).toBe('Export Approved');
    expect(buttons[1].textContent).toBe('Additional Actions');
  });

  it('the full transcript section is a card', () => {
    render({ clip_count: 3, status: 'done' });
    expect(detail().querySelectorAll('#video-transcript-details.detail-card')).toHaveLength(1);
  });
});

describe('renderVideoDetail run-timing provenance line', () => {
  it('shows the total and per-stage timing from analyze_run', () => {
    render({ analyze_run: MOCK_ANALYZE_RUN });
    expect(detail().textContent).toContain(
      `Last run: 4m 12s total (extract 12s ${MID} transcribe 3m 01s ${MID} speakers 38s ${MID} score 41s)`,
    );
  });

  it('omits the timing line when analyze_run is null', () => {
    render({ analyze_run: null });
    expect(detail().textContent).not.toContain('Last run:');
  });
});
