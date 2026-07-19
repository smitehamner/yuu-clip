// Inline speaker rename from the transcript's name label (static/analyze/transcript.js).
//
// The guard against opening two editors on one label has to be claimed BEFORE the
// speaker fetch is awaited: that fetch is uncached on first use, so a second click
// during it used to pass the `editing` check too - appending a second <input> and
// capturing `original` from the already-blanked label, so a later Escape restored an
// empty name. The DOM wiring (delegated click/keydown on #detail) stays in Playwright.
vi.mock('../../../yuu_clip/web/static/core/utils.js', async (importActual) => {
  const actual = await importActual();
  return { ...actual, showToast: vi.fn() };
});
vi.mock('../../../yuu_clip/web/static/people/speakers.js', () => ({ loadSpeakers: vi.fn() }));
vi.mock('../../../yuu_clip/web/static/clips/clips.js', () => ({ refreshClipDetail: vi.fn() }));

import { startRenameSpeaker } from '../../../yuu_clip/web/static/analyze/transcript.js';

// The speaker list is cached per video, so each test uses a fresh video id to keep the
// uncached (awaiting) first-fetch path under test.
let nextVideoId = 900;

function makeLabel(text, { speakerId = 7 } = {}) {
  const label = document.createElement('div');
  label.className = 'tline-speaker editable';
  label.dataset.speakerId = String(speakerId);
  label.dataset.videoId = String(++nextVideoId);
  label.textContent = text;
  document.body.appendChild(label);
  return label;
}

// Resolves the speakers fetch only when the test says so, so both clicks land while
// the first call is still awaiting - the exact window the bug lived in.
function deferredSpeakersFetch(speakers) {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
    await gate;
    return { ok: true, json: async () => speakers };
  });
  return () => release();
}

afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; });

describe('startRenameSpeaker', () => {
  it('a second click during the speaker fetch does not open a second editor', async () => {
    const label = makeLabel('Speaker 1');
    const release = deferredSpeakersFetch([{ id: 7, name: '', display_name: 'Speaker 1' }]);

    const first = startRenameSpeaker(label);
    const second = startRenameSpeaker(label); // lands while the fetch is still pending
    release();
    await Promise.all([first, second]);

    expect(label.querySelectorAll('input').length).toBe(1);
  });

  it('escaping after a double click restores the real name, not a blank label', async () => {
    const label = makeLabel('Speaker 1');
    const release = deferredSpeakersFetch([{ id: 7, name: '', display_name: 'Speaker 1' }]);

    const first = startRenameSpeaker(label);
    const second = startRenameSpeaker(label);
    release();
    await Promise.all([first, second]);

    label.querySelector('input').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(label.textContent).toBe('Speaker 1');
    expect(label.classList.contains('editing')).toBe(false);
  });

  it('a single rename still opens one editor prefilled with the raw name', async () => {
    const label = makeLabel('Alice');
    const release = deferredSpeakersFetch([{ id: 7, name: 'Alice', display_name: 'Alice' }]);

    const opening = startRenameSpeaker(label);
    release();
    await opening;

    const input = label.querySelector('input');
    expect(input).not.toBe(null);
    expect(input.value).toBe('Alice');
    expect(label.classList.contains('editing')).toBe(true);
  });

  it('an unnamed speaker opens an empty field rather than editing the fallback label', async () => {
    const label = makeLabel('Speaker 3');
    const release = deferredSpeakersFetch([{ id: 7, name: '', display_name: 'Speaker 3' }]);

    const opening = startRenameSpeaker(label);
    release();
    await opening;

    expect(label.querySelector('input').value).toBe('');
  });
});
