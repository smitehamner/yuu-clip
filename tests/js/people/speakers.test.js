// Suggestion-display gating in the Speakers card (static/people/speakers.js).
// The server now filters bogus "Speaker N" name suggestions, but this frontend guard
// also hides any already written to the DB by an older run so they stop showing.
import { AppState } from '../../../yuu_clip/web/static/core/state.js';

vi.mock('../../../yuu_clip/web/static/core/ui.js', async (importActual) => {
  const actual = await importActual();
  return { ...actual, showConfirm: vi.fn((title, body, okLabel, onOk) => onOk()) };
});

import { showConfirm } from '../../../yuu_clip/web/static/core/ui.js';
import {
  _isSuggestion, loadSpeakers, _saveSpeakerName, _saveSpeakerColor, _resolveSuggestion,
  _resolveVoiceMatch, _createSpeaker, _mergeSpeakerInto, _promoteToPerson, _resolvePersonMatch,
} from '../../../yuu_clip/web/static/people/speakers.js';

describe('_isSuggestion', () => {
  const base = { source: 'inferred', confirmed: false, name: 'Alice' };

  it('is a suggestion for an unconfirmed inferred real name', () => {
    expect(_isSuggestion(base)).toBe(true);
  });

  it('hides a "Speaker N" placeholder echoed as a name', () => {
    expect(_isSuggestion({ ...base, name: 'Speaker 55' })).toBe(false);
    expect(_isSuggestion({ ...base, name: '  speaker 2 ' })).toBe(false);
  });

  it('is not a suggestion once confirmed or when there is no name', () => {
    expect(_isSuggestion({ ...base, confirmed: true })).toBe(false);
    expect(_isSuggestion({ ...base, name: '' })).toBe(false);
  });
});

// The PUT/POST request shape sent by each Speakers-card action. Ported from the
// request-assertion half of tests/ui/test_ui_speakers.py: the real card render
// (loadSpeakers -> fetch -> DOM), the colorpicker widget, and the confirm-modal
// show/hide wiring for the merge flow all stay in Playwright as the live proof;
// this covers only what request each action actually sends, browserless.
describe('Speakers card actions', () => {
  const okJson = (body = {}) => Promise.resolve({ ok: true, json: async () => body });

  // _currentVideoId is module-private, set only by loadSpeakers - matches how
  // every one of these actions is reached for real (the card must be loaded first).
  // #speakers-section is normally injected by renderVideoDetail (videos.js), not
  // static index.html markup - loadSpeakers no-ops without it, so seed it directly.
  async function seedCurrentVideo(videoId = 7) {
    document.getElementById('detail').innerHTML = '<div id="speakers-section"></div>';
    globalThis.fetch = vi.fn(() => okJson([{ id: 1, display_index: 1, color: '#4fc3f7' }]));
    await loadSpeakers(videoId);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    AppState.activeClipId = null;
    window.reloadVideoTranscriptIfOpen = vi.fn();
  });

  afterEach(() => { delete globalThis.fetch; delete window.reloadVideoTranscriptIfOpen; });

  it('_saveSpeakerName PUTs the trimmed name', async () => {
    await seedCurrentVideo();
    globalThis.fetch = vi.fn(() => okJson({ is_named: true, display_name: 'Yuu' }));
    await _saveSpeakerName(1, 'Yuu');
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/speakers/1', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Yuu' }),
    });
  });

  it('_saveSpeakerColor PUTs the hex value', async () => {
    await seedCurrentVideo();
    globalThis.fetch = vi.fn(() => okJson({ color: '#abcdef' }));
    await _saveSpeakerColor(1, '#abcdef');
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/speakers/1', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ color: '#abcdef' }),
    });
  });

  it('_resolveSuggestion accepting PUTs the suggested name', async () => {
    await seedCurrentVideo();
    globalThis.fetch = vi.fn(() => okJson({ is_named: true, display_name: 'Yuu' }));
    await _resolveSuggestion(1, 'Yuu');
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/speakers/1', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Yuu' }),
    });
  });

  it('_resolveSuggestion dismissing PUTs an empty name', async () => {
    await seedCurrentVideo();
    globalThis.fetch = vi.fn(() => okJson({ is_named: false }));
    await _resolveSuggestion(1, '');
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/speakers/1', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: '' }),
    });
  });

  it('_resolveVoiceMatch "same voice" POSTs confirm-match', async () => {
    await seedCurrentVideo();
    globalThis.fetch = vi.fn(() => okJson({}));
    await _resolveVoiceMatch(1, true, 'Yuu');
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/speakers/1/confirm-match', { method: 'POST' });
  });

  it('_resolveVoiceMatch "different voice" POSTs reject-match', async () => {
    await seedCurrentVideo();
    globalThis.fetch = vi.fn(() => okJson({}));
    await _resolveVoiceMatch(1, false);
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/speakers/1/reject-match', { method: 'POST' });
  });

  it('_createSpeaker POSTs to the video\'s speakers collection', async () => {
    await seedCurrentVideo(7);
    globalThis.fetch = vi.fn(() => okJson({ display_name: 'Speaker 2' }));
    await _createSpeaker();
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/videos/7/speakers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
  });

  it('_mergeSpeakerInto confirms, then POSTs the merge', async () => {
    await seedCurrentVideo();
    globalThis.fetch = vi.fn(() => okJson({}));
    await _mergeSpeakerInto(1, 2, 'Bob');
    expect(showConfirm).toHaveBeenCalledTimes(1);
    expect(showConfirm.mock.calls[0][0]).toBe('Merge speakers?');
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/speakers/1/merge-into/2', { method: 'POST' });
  });

  it('_promoteToPerson POSTs the speaker id to /api/voices', async () => {
    await seedCurrentVideo();
    globalThis.fetch = vi.fn(() => okJson({ display_name: 'Yuu' }));
    await _promoteToPerson(1);
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/voices', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ speaker_id: 1 }),
    });
  });

  it('_resolvePersonMatch "same person" POSTs confirm-voice', async () => {
    await seedCurrentVideo();
    globalThis.fetch = vi.fn(() => okJson({}));
    await _resolvePersonMatch(1, true, 'Yuu');
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/speakers/1/confirm-voice', { method: 'POST' });
  });

  it('_resolvePersonMatch "not them" POSTs reject-voice', async () => {
    await seedCurrentVideo();
    globalThis.fetch = vi.fn(() => okJson({}));
    await _resolvePersonMatch(1, false);
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/speakers/1/reject-voice', { method: 'POST' });
  });
});
