// Whole-recording "Re-transcribe Recording" now prompts for the Whisper model
// (BUG 3 / W3): retranscribeVideoRun (static/videos/videos.js) opens a confirm with a
// model <select> cloned from the canonical clip-retranscribe list, and the chosen
// model flows into the SSE URL. showConfirm + streamSSE are mocked so the assertion is
// on what the flow requests, not on a live server.
import { AppState } from '../../../yuu_clip/web/static/core/state.js';

const confirmCalls = [];
vi.mock('../../../yuu_clip/web/static/core/ui.js', async (importActual) => {
  const actual = await importActual();
  return {
    ...actual,
    showConfirm: vi.fn((title, body, okLabel, onOk) => confirmCalls.push({ title, body, okLabel, onOk })),
  };
});

const streamCalls = [];
vi.mock('../../../yuu_clip/web/static/core/jobs.js', async (importActual) => {
  const actual = await importActual();
  return {
    ...actual,
    _blockedByAnalyze: vi.fn(() => false),
    streamSSE: vi.fn((url) => streamCalls.push(url)),
  };
});
vi.mock('../../../yuu_clip/web/static/core/preview.js', async (importActual) => ({
  ...(await importActual()),
  setupRecordingPreview: vi.fn(),
}));

import {
  retranscribeVideoRun, _whisperModelOptionsHtml,
} from '../../../yuu_clip/web/static/videos/videos.js';

// The picker preselects the project's configured model (DOC-CLAIMS row 6: the default
// Whisper model is "base"), so /api/config is stubbed rather than hit for real.
let configResponse = { whisper_model: 'medium' };

beforeEach(() => {
  confirmCalls.length = 0;
  streamCalls.length = 0;
  configResponse = { whisper_model: 'medium' };
  AppState.videos = [{ id: 7, filename: 'session.mkv' }];
  AppState.activeVideoId = null;
  globalThis.fetch = vi.fn(() => Promise.resolve({ json: () => Promise.resolve(configResponse) }));
});

describe('_whisperModelOptionsHtml', () => {
  it('clones the canonical retranscribe-model options and marks the selection', () => {
    const html = _whisperModelOptionsHtml('small');
    expect(html).toContain('<option value="tiny"');
    expect(html).toContain('<option value="small" selected>');
    expect(html).toContain('<option value="large-v3"');
    expect(html.match(/selected/g)).toHaveLength(1);
  });
});

describe('retranscribeVideoRun', () => {
  it('prompts with a model picker instead of starting immediately', async () => {
    await retranscribeVideoRun(7);
    expect(confirmCalls).toHaveLength(1);
    expect(confirmCalls[0].okLabel).toBe('Re-transcribe');
    expect(confirmCalls[0].body).toContain('id="video-retx-model"');
    expect(streamCalls).toHaveLength(0); // nothing runs until confirmed
  });

  it('preselects the configured Whisper model', async () => {
    await retranscribeVideoRun(7);
    expect(confirmCalls[0].body).toContain('<option value="medium" selected>');
  });

  it('falls back to base when no model is configured', async () => {
    configResponse = {};
    await retranscribeVideoRun(7);
    expect(confirmCalls[0].body).toContain('<option value="base" selected>');
  });

  it('sends the chosen model to the retranscribe endpoint on confirm', async () => {
    await retranscribeVideoRun(7);
    // Reproduce showConfirm's DOM injection so the callback can read the select
    // (the real showConfirm leaves the body in the DOM while onOk runs).
    const host = document.createElement('div');
    host.innerHTML = confirmCalls[0].body;
    document.body.appendChild(host);
    host.querySelector('#video-retx-model').value = 'small';
    confirmCalls[0].onOk();
    expect(streamCalls).toEqual(['/api/videos/7/retranscribe?model=small']);
  });

  it('falls back to the configured model when the picker is unexpectedly absent', async () => {
    await retranscribeVideoRun(7);
    confirmCalls[0].onOk(); // no DOM injection - select missing
    expect(streamCalls).toEqual(['/api/videos/7/retranscribe?model=medium']);
  });
});
