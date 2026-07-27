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

import {
  startRenameSpeaker, updateSpeakerLabelsInTranscript, _transcriptLineFlags,
  _highlightHtml, _parseClock,
} from '../../../yuu_clip/web/static/analyze/transcript.js';

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

describe('_transcriptLineFlags', () => {
  const line = (over = {}) => ({ speaker: 'Alice', speaker_id: 7, seg_id: 3, ...over });
  const opts = (over = {}) => ({ videoId: 42, readOnly: false, diarized: true, ...over });

  it('shows the speaker label only when the name differs from the previous line', () => {
    expect(_transcriptLineFlags(line(), 'Bob', opts()).showSpeaker).toBe(true);
    expect(_transcriptLineFlags(line(), 'Alice', opts()).showSpeaker).toBe(false);
  });

  it('never shows a label for a line with no speaker', () => {
    expect(_transcriptLineFlags(line({ speaker: null }), null, opts()).showSpeaker).toBe(false);
  });

  it('makes the name editable only for a diarized line in an editable (videoId) transcript', () => {
    expect(_transcriptLineFlags(line(), null, opts()).nameEditable).toBe(true);
    expect(_transcriptLineFlags(line(), null, opts({ videoId: null })).nameEditable).toBe(false);
    expect(_transcriptLineFlags(line({ speaker_id: null }), null, opts()).nameEditable).toBe(false);
  });

  it('makes the caption editable only when not read-only and the line has a seg_id', () => {
    expect(_transcriptLineFlags(line(), null, opts()).editable).toBe(true);
    expect(_transcriptLineFlags(line(), null, opts({ readOnly: true })).editable).toBe(false);
    expect(_transcriptLineFlags(line({ seg_id: null }), null, opts()).editable).toBe(false);
  });

  it('gives a speaker dot to a diarized line with a seg_id, including an unassigned one', () => {
    expect(_transcriptLineFlags(line({ speaker_id: null }), null, opts()).hasSpeakerDot).toBe(true);
    expect(_transcriptLineFlags(line(), null, opts({ diarized: false })).hasSpeakerDot).toBe(false);
    expect(_transcriptLineFlags(line({ seg_id: null }), null, opts()).hasSpeakerDot).toBe(false);
  });
});

describe('_highlightHtml (transcript search)', () => {
  it('returns plain escaped text when there is no query', () => {
    expect(_highlightHtml('a <b> & "c"', '')).toBe('a &lt;b&gt; &amp; &quot;c&quot;');
  });

  it('wraps each case-insensitive match in a <mark class="tx-hit">', () => {
    expect(_highlightHtml('Go Go go', 'go')).toBe(
      '<mark class="tx-hit">Go</mark> <mark class="tx-hit">Go</mark> <mark class="tx-hit">go</mark>');
  });

  it('escapes both the matched and unmatched slices', () => {
    // query is pre-lowercased by the caller; the match keeps the source casing/entities.
    expect(_highlightHtml('x <y> z', '<y>')).toBe('x <mark class="tx-hit">&lt;y&gt;</mark> z');
  });

  it('leaves text untouched when the query does not occur', () => {
    expect(_highlightHtml('hello', 'zzz')).toBe('hello');
  });
});

describe('_parseClock (jump-to-time)', () => {
  it('parses mm:ss and h:mm:ss into seconds', () => {
    expect(_parseClock('4:30')).toBe(270);
    expect(_parseClock('1:02:03')).toBe(3723);
    expect(_parseClock('45')).toBe(45);
  });

  it('rejects blank or non-numeric input', () => {
    expect(_parseClock('')).toBe(null);
    expect(_parseClock('  ')).toBe(null);
    expect(_parseClock('4:xx')).toBe(null);
    expect(_parseClock('1:2:3:4')).toBe(null);
  });
});

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

  it('saving a rename patches the label in place and closes the editor (no full reload)', async () => {
    const label = makeLabel('Speaker 1');
    // GET speakers list (opens the editor), then the PUT rename returns the new name.
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, opts) => {
      if (opts && opts.method === 'PUT') {
        return { ok: true, json: async () => ({ display_name: 'Alice', is_named: true, color: '#abc' }) };
      }
      return { ok: true, json: async () => [{ id: 7, name: '', display_name: 'Speaker 1' }] };
    });

    await startRenameSpeaker(label);
    const input = label.querySelector('input');
    input.value = 'Alice';
    label.querySelector('.tline-edit-actions .btn.primary').click();
    await vi.waitFor(() => expect(label.classList.contains('editing')).toBe(false));

    expect(label.textContent).toBe('Alice');
    expect(label.querySelector('input')).toBe(null);
  });
});

describe('updateSpeakerLabelsInTranscript', () => {
  // Two speakers, each with a name label and a dot chip, so we can assert the patch is
  // scoped to the targeted speaker and never touches the other.
  function seedRows() {
    document.body.innerHTML = `
      <div class="tline-speaker" data-speaker-id="7">Speaker 1</div>
      <button class="tline-spk" data-speaker-id="7" title="Speaker 1 - click to change or rename">
        <span class="tline-spk-dot" style="background:#111"></span></button>
      <div class="tline-speaker" data-speaker-id="9">Speaker 2</div>
      <button class="tline-spk" data-speaker-id="9" title="Speaker 2 - click to change or rename">
        <span class="tline-spk-dot" style="background:#222"></span></button>`;
  }

  it('renames every row for the target speaker and leaves other speakers alone', () => {
    seedRows();
    updateSpeakerLabelsInTranscript(7, { displayName: 'Alice' });
    expect(document.querySelector('.tline-speaker[data-speaker-id="7"]').textContent).toBe('Alice');
    expect(document.querySelector('.tline-spk[data-speaker-id="7"]').title).toBe('Alice - click to change or rename');
    expect(document.querySelector('.tline-speaker[data-speaker-id="9"]').textContent).toBe('Speaker 2');
  });

  it('recolours the dot and label for the target speaker', () => {
    seedRows();
    updateSpeakerLabelsInTranscript(7, { color: '#4fc3f7' });
    expect(document.querySelector('.tline-spk[data-speaker-id="7"] .tline-spk-dot').style.background).toBe('#4fc3f7');
    expect(document.querySelector('.tline-spk[data-speaker-id="9"] .tline-spk-dot').style.background).toBe('#222');
  });

  it('never clobbers a label the user is mid-rename on', () => {
    seedRows();
    const editing = document.querySelector('.tline-speaker[data-speaker-id="7"]');
    editing.classList.add('editing');
    editing.textContent = 'typing...';
    updateSpeakerLabelsInTranscript(7, { displayName: 'Alice' });
    expect(editing.textContent).toBe('typing...');
  });
});
