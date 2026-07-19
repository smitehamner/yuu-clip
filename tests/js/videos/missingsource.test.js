// A recording whose source file has been moved/deleted must not render a <video>
// that just fails to load - renderVideoDetail (static/videos/videos.js) swaps the
// player for a "Recording file not found" notice, and the sidebar row flags it.
// setupRecordingPreview is mocked so the test can assert it is never wired up.
import { AppState } from '../../../yuu_clip/web/static/core/state.js';

const previewCalls = [];
vi.mock('../../../yuu_clip/web/static/core/preview.js', async (importActual) => {
  const actual = await importActual();
  return { ...actual, setupRecordingPreview: vi.fn((...args) => previewCalls.push(args)) };
});

import {
  renderVideoDetail, _renderVideoList, _missingSourceHtml,
} from '../../../yuu_clip/web/static/videos/videos.js';

function baseVideo(overrides = {}) {
  return Object.assign({
    id: 1,
    title: 'My Session',
    filename: 'session.mkv',
    title_is_edited: false,
    duration_hms: '1:02:03',
    duration_ms: 3723000,
    clip_count: 5,
    total_clip_ms: 300000,
    approved: 2,
    exported: 1,
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
    source_path: 'D:\\Recordings\\session.mkv',
  }, overrides);
}

beforeEach(() => {
  previewCalls.length = 0;
  AppState.activeVideoId = 1;
  AppState.contexts = [];
  AppState.canReveal = false;
  AppState.analyzeFilename = null;
  AppState.videoSearch = '';
  AppState.videoSort = 'recent';
  AppState.videoFilters = new Set();
  AppState.videoSortDir = 'desc';
  // Detail-card seams videos.js still reads as window.* (see main.esm.js's residual
  // shim); stubbed so the assertions stay on the player area this test owns.
  window._renderRunMetaCard = () => '';
  window._renderTimelineHTML = () => '';
  window._timelineEmptyNoteHTML = () => '';
  globalThis.fetch = vi.fn(() => Promise.resolve({ json: () => Promise.resolve({}) }));
});

describe('_missingSourceHtml', () => {
  it('names the problem in plain language and shows the missing path', () => {
    const html = _missingSourceHtml(baseVideo({ source_exists: false }));
    expect(html).toContain('Recording file not found');
    expect(html).toContain('D:\\Recordings\\session.mkv');
    // Reassures that the derived work survives - the file is the only thing lost.
    expect(html).toMatch(/clips, transcript, and\s+scores are all still here/);
  });
});

describe('renderVideoDetail source-file handling', () => {
  it('replaces the player with the notice and wires no preview when the file is gone', () => {
    renderVideoDetail(baseVideo({ source_exists: false }), null);
    const playerArea = document.getElementById('player-area');
    expect(playerArea.querySelector('video')).toBeNull();
    expect(playerArea.textContent).toContain('Recording file not found');
    expect(previewCalls).toHaveLength(0);
  });

  it('renders the player normally when the file is present', () => {
    renderVideoDetail(baseVideo({ source_exists: true }), null);
    const playerArea = document.getElementById('player-area');
    expect(playerArea.querySelector('video')).not.toBeNull();
    expect(playerArea.textContent).not.toContain('Recording file not found');
    expect(previewCalls).toHaveLength(1);
  });

  // An older payload predating the flag must not be mistaken for a missing file.
  it('renders the player when source_exists is absent', () => {
    const video = baseVideo();
    delete video.source_exists;
    renderVideoDetail(video, null);
    expect(document.getElementById('player-area').querySelector('video')).not.toBeNull();
    expect(previewCalls).toHaveLength(1);
  });
});

describe('recording list', () => {
  const rowText = () => document.getElementById('video-list').textContent;

  it('flags a recording whose source file is missing', () => {
    AppState.videos = [baseVideo({ source_exists: false })];
    _renderVideoList();
    expect(rowText()).toContain('Recording file not found');
  });

  it('leaves a present recording unflagged', () => {
    AppState.videos = [baseVideo({ source_exists: true })];
    _renderVideoList();
    expect(rowText()).not.toContain('Recording file not found');
  });
});
