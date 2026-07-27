// Ported-pattern from namecorrections.test.js - drives the real openPeopleView ->
// PanelNav.open -> fetch(voices+characters) -> render chain against the seeded DOM,
// mocking only fetch and the toast/confirm seams. tests/ui/test_ui_voices.py stays the
// live-browser proof (colorpicker widget, confirm-modal focus); this covers request
// shapes and render/gating logic browserless, since this module had zero tests/js
// coverage.
//
// _syncOpenRecording's cross-module refresh (speakers.js/transcript.js/clips.js) is
// exercised for real rather than mocked: voices.js <-> speakers.js <-> transcript.js
// form a genuine import cycle (speakers.js imports openPeopleView from voices.js), and
// vi.mock + importActual on a module inside a live cycle does not reliably intercept
// the binding the cyclic importer sees - the same class of limitation core/jobs.js
// documents for its own 9 window.* reads. Seeding #speakers-section and letting the
// real loadSpeakers() fetch and render is both simpler and a truer proof.
import { AppState } from '../../../yuu_clip/web/static/core/state.js';

vi.mock('../../../yuu_clip/web/static/core/utils.js', async (importActual) => {
  const actual = await importActual();
  return { ...actual, showToast: vi.fn() };
});
vi.mock('../../../yuu_clip/web/static/core/ui.js', async (importActual) => {
  const actual = await importActual();
  return { ...actual, showConfirm: vi.fn((title, body, okLabel, onOk) => onOk()) };
});

import { showToast } from '../../../yuu_clip/web/static/core/utils.js';
import { showConfirm } from '../../../yuu_clip/web/static/core/ui.js';
import { openPeopleView, isPeopleOpen } from '../../../yuu_clip/web/static/people/voices.js';

const okJson = (body = {}) => Promise.resolve({ ok: true, json: async () => body });
const errJson = (body = {}) => Promise.resolve({ ok: false, json: async () => body });

const ONE_VOICE = [{
  id: 1, display_name: 'Yuu', name: 'Yuu', color: '#4fc3f7', member_count: 2,
  characters: [],
  members: [
    { speaker_id: 10, display_name: 'Speaker 1', video_filename: 'session1.mkv' },
    { speaker_id: 11, display_name: 'Speaker 1', video_filename: 'session2.mkv' },
  ],
  suggestions: [],
}];

const TWO_VOICES = [
  ...ONE_VOICE,
  {
    id: 2, display_name: 'Mara', name: 'Mara', color: '#f0803c', member_count: 1,
    characters: [], members: [], suggestions: [],
  },
];

function stubFetch({ voices = ONE_VOICE, characters = [] } = {}) {
  vi.stubGlobal('fetch', vi.fn((url) => {
    const u = String(url);
    if (u === '/api/voices') return okJson(voices);
    if (u === '/api/characters') return okJson(characters);
    return Promise.reject(new Error(`unexpected fetch: ${u}`));
  }));
}

async function openPanel(opts) {
  stubFetch(opts);
  openPeopleView();
  await vi.waitFor(() => {
    expect(document.getElementById('people-list').textContent).not.toContain('Loading');
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  AppState.activeVideoId = null;
  AppState.activeClipId = null;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('openPeopleView', () => {
  it('renders a card per person with their members', async () => {
    await openPanel();
    expect(isPeopleOpen()).toBe(true);
    expect(document.querySelectorAll('.person-card')).toHaveLength(1);
    expect(document.querySelector('.person-count').textContent).toBe('2 recordings');
    expect(document.querySelectorAll('.person-member')).toHaveLength(2);
  });

  it('shows an empty state with no people yet', async () => {
    await openPanel({ voices: [] });
    expect(document.getElementById('people-list').textContent).toContain('No people yet');
    expect(document.querySelectorAll('.person-card')).toHaveLength(0);
  });

  it('shows a load-failure message when the fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
    openPeopleView();
    await vi.waitFor(() => {
      expect(document.getElementById('people-list').textContent).toContain('Could not load people');
    });
  });

  it('omits the merge control when there is only one person', async () => {
    await openPanel({ voices: ONE_VOICE });
    expect(document.querySelector('.voice-merge-select')).toBe(null);
  });

  it('offers every other person in the merge control when there are several', async () => {
    await openPanel({ voices: TWO_VOICES });
    const selects = document.querySelectorAll('.voice-merge-select');
    expect(selects).toHaveLength(2);
    expect(selects[0].querySelectorAll('option')).toHaveLength(2); // placeholder + the other person
  });

  it('omits the character picker with no characters and no existing link', async () => {
    await openPanel({ voices: ONE_VOICE, characters: [] });
    expect(document.querySelector('.voice-character-select')).toBe(null);
  });

  it('shows one picker per context, listing only that context\'s characters', async () => {
    await openPanel({
      voices: ONE_VOICE,
      characters: [
        { id: 5, name: 'Rin', context_slug: 'fantasy', context_name: 'Fantasy World' },
        { id: 6, name: 'Kai', context_slug: 'fantasy', context_name: 'Fantasy World' },
      ],
    });
    const selects = document.querySelectorAll('.voice-character-select');
    expect(selects).toHaveLength(1); // one context -> one row
    expect(selects[0].querySelectorAll('option')).toHaveLength(3); // "No character" + 2
  });

  it('renders an independent picker per context when the Person spans several', async () => {
    await openPanel({
      voices: [{ ...ONE_VOICE[0], characters: [{ id: 5, name: 'Aldric', context_slug: 'fantasy' }] }],
      characters: [
        { id: 5, name: 'Aldric', context_slug: 'fantasy', context_name: 'Fantasy World' },
        { id: 7, name: 'Vex', context_slug: 'scifi', context_name: 'Sci-Fi World' },
      ],
    });
    const selects = document.querySelectorAll('.voice-character-select');
    expect(selects).toHaveLength(2);
    const fantasySelect = document.querySelector('[data-context-slug="fantasy"]');
    const scifiSelect = document.querySelector('[data-context-slug="scifi"]');
    expect(fantasySelect.value).toBe('5');
    expect(scifiSelect.value).toBe(''); // no alias in this context yet
  });

  it('still shows a linked character as selected even when /api/characters fails to load', async () => {
    await openPanel({
      voices: [{ ...ONE_VOICE[0], characters: [{ id: 99, name: 'Ghost Link', context_slug: 'ghost-ctx' }] }],
      characters: [],
    });
    const select = document.querySelector('.voice-character-select');
    const selected = select.querySelector('option[selected]');
    expect(selected.value).toBe('99');
    expect(selected.textContent).toBe('Ghost Link');
  });
});

describe('People card actions', () => {
  it('renaming PUTs the trimmed name and reloads the list', async () => {
    await openPanel();
    const fetchMock = vi.fn((url, opts) => {
      if (String(url) === '/api/voices/1' && opts?.method === 'PUT') {
        return okJson({ is_named: true, display_name: 'Yuu' });
      }
      return okJson(ONE_VOICE);
    });
    vi.stubGlobal('fetch', fetchMock);

    const nameInput = document.querySelector('.voice-name-input');
    nameInput.value = '  Yuu  ';
    nameInput.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => expect(showToast).toHaveBeenCalled());

    expect(fetchMock).toHaveBeenCalledWith('/api/voices/1', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Yuu' }),
    });
    expect(showToast).toHaveBeenCalledWith('Named Yuu');
  });

  it('recoloring PUTs the hex value', async () => {
    await openPanel();
    const fetchMock = vi.fn((url) => {
      if (String(url) === '/api/voices/1') return okJson({ color: '#abcdef' });
      return okJson(ONE_VOICE);
    });
    vi.stubGlobal('fetch', fetchMock);

    const colorInput = document.querySelector('.voice-color-input');
    colorInput.value = '#abcdef';
    colorInput.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(fetchMock).toHaveBeenCalledWith('/api/voices/1', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ color: '#abcdef' }),
    });
  });

  it('merging confirms then POSTs the other person\'s id', async () => {
    await openPanel({ voices: TWO_VOICES });
    const fetchMock = vi.fn((url) => {
      if (String(url) === '/api/voices/1/merge') return okJson({});
      return okJson(TWO_VOICES);
    });
    vi.stubGlobal('fetch', fetchMock);

    const select = document.querySelector('.voice-merge-select[data-voice-id="1"]');
    select.value = '2';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => expect(showToast).toHaveBeenCalledWith('People merged'));

    expect(showConfirm).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/voices/1/merge', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ other_id: 2 }),
    });
  });

  it('removing a member recording confirms then POSTs a split', async () => {
    await openPanel();
    const fetchMock = vi.fn((url) => {
      if (String(url) === '/api/voices/1/split') return okJson({});
      return okJson(ONE_VOICE);
    });
    vi.stubGlobal('fetch', fetchMock);

    document.querySelector('.voice-detach-btn').click();
    await vi.waitFor(() => expect(showConfirm).toHaveBeenCalled());

    expect(fetchMock).toHaveBeenCalledWith('/api/voices/1/split', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ speaker_id: 10 }),
    });
    expect(showToast).toHaveBeenCalledWith('Recording removed from this person');
  });

  it('linking a character POSTs the context slug and character id', async () => {
    await openPanel({ voices: ONE_VOICE, characters: [{ id: 5, name: 'Rin', context_slug: 'w', context_name: 'World' }] });
    const fetchMock = vi.fn((url) => {
      if (String(url) === '/api/voices/1/characters') return okJson({});
      return okJson(ONE_VOICE);
    });
    vi.stubGlobal('fetch', fetchMock);

    const select = document.querySelector('.voice-character-select');
    select.value = '5';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(fetchMock).toHaveBeenCalledWith('/api/voices/1/characters', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context_slug: 'w', character_id: 5 }),
    });
    expect(showToast).toHaveBeenCalledWith('Linked in World');
  });

  it('unlinking a character POSTs a null character id for that context', async () => {
    await openPanel({
      voices: [{ ...ONE_VOICE[0], characters: [{ id: 5, name: 'Rin', context_slug: 'w' }] }],
      characters: [{ id: 5, name: 'Rin', context_slug: 'w', context_name: 'World' }],
    });
    const fetchMock = vi.fn((url) => {
      if (String(url) === '/api/voices/1/characters') return okJson({});
      return okJson(ONE_VOICE);
    });
    vi.stubGlobal('fetch', fetchMock);

    const select = document.querySelector('.voice-character-select');
    select.value = '';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(fetchMock).toHaveBeenCalledWith('/api/voices/1/characters', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context_slug: 'w', character_id: null }),
    });
    expect(showToast).toHaveBeenCalledWith('Unlinked from World');
  });

  it('shows the server error detail when a save fails', async () => {
    await openPanel();
    vi.stubGlobal('fetch', vi.fn(() => errJson({ detail: 'Name already in use' })));

    document.querySelector('.voice-name-input').dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => expect(showToast).toHaveBeenCalled());

    expect(showToast).toHaveBeenCalledWith('Could not save: Name already in use', 'error');
  });
});

describe('Suggestions and backfill', () => {
  const WITH_SUGGESTION = [{
    ...ONE_VOICE[0],
    suggestions: [{ speaker_id: 22, video_filename: 'other.mkv', score: 0.83 }],
  }];

  it('confirming a suggestion POSTs confirm-voice', async () => {
    await openPanel({ voices: WITH_SUGGESTION });
    const fetchMock = vi.fn((url) => {
      if (String(url) === '/api/speakers/22/confirm-voice') return okJson({});
      return okJson(ONE_VOICE);
    });
    vi.stubGlobal('fetch', fetchMock);

    document.querySelector('.voice-confirm-btn').click();
    await vi.waitFor(() => expect(showToast).toHaveBeenCalled());

    expect(fetchMock).toHaveBeenCalledWith('/api/speakers/22/confirm-voice', { method: 'POST' });
    expect(showToast).toHaveBeenCalledWith('Confirmed - same person');
  });

  it('rejecting a suggestion POSTs reject-voice', async () => {
    await openPanel({ voices: WITH_SUGGESTION });
    const fetchMock = vi.fn((url) => {
      if (String(url) === '/api/speakers/22/reject-voice') return okJson({});
      return okJson(ONE_VOICE);
    });
    vi.stubGlobal('fetch', fetchMock);

    document.querySelector('.voice-reject-btn').click();
    await vi.waitFor(() => expect(showToast).toHaveBeenCalled());

    expect(fetchMock).toHaveBeenCalledWith('/api/speakers/22/reject-voice', { method: 'POST' });
    expect(showToast).toHaveBeenCalledWith('Kept separate');
  });

  it('backfill reports how many new people it found', async () => {
    await openPanel();
    const fetchMock = vi.fn((url) => {
      if (String(url) === '/api/voices/backfill') return okJson({ created: 3 });
      return okJson(ONE_VOICE);
    });
    vi.stubGlobal('fetch', fetchMock);

    document.getElementById('people-backfill-btn').click();
    await vi.waitFor(() => expect(showToast).toHaveBeenCalled());

    expect(showToast).toHaveBeenCalledWith('Found 3 people to review');
  });

  it('backfill reports when nothing new was found', async () => {
    await openPanel();
    vi.stubGlobal('fetch', vi.fn((url) => {
      if (String(url) === '/api/voices/backfill') return okJson({ created: 0 });
      return okJson(ONE_VOICE);
    }));

    document.getElementById('people-backfill-btn').click();
    await vi.waitFor(() => expect(showToast).toHaveBeenCalled());

    expect(showToast).toHaveBeenCalledWith('No new people found across your recordings');
  });
});

describe('syncing the open recording after a change', () => {
  const SPEAKER = { id: 1, display_index: 1, color: '#4fc3f7', display_name: 'Speaker 1' };

  it('refreshes the real Speakers card for the active recording', async () => {
    AppState.activeVideoId = 7;
    document.getElementById('detail').innerHTML = '<div id="speakers-section"></div>';
    await openPanel();
    const fetchMock = vi.fn((url) => {
      if (String(url) === '/api/voices/1') return okJson({ color: '#abcdef' });
      if (String(url) === '/api/videos/7/speakers') return okJson([SPEAKER]);
      return okJson(ONE_VOICE);
    });
    vi.stubGlobal('fetch', fetchMock);

    document.querySelector('.voice-color-input').dispatchEvent(new Event('change', { bubbles: true }));

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/videos/7/speakers'));
    await vi.waitFor(() => {
      expect(document.getElementById('speakers-section').textContent).not.toBe('');
    });
    expect(showToast).not.toHaveBeenCalledWith(expect.stringContaining('Could not save'), 'error');
  });

  it('does not touch the recording view when no recording is open', async () => {
    AppState.activeVideoId = null;
    document.getElementById('detail').innerHTML = '<div id="speakers-section"></div>';
    await openPanel();
    const fetchMock = vi.fn((url) => {
      if (String(url) === '/api/voices/1') return okJson({ color: '#abcdef' });
      if (String(url) === '/api/videos/7/speakers') return okJson([SPEAKER]);
      return okJson(ONE_VOICE);
    });
    vi.stubGlobal('fetch', fetchMock);

    document.querySelector('.voice-color-input').dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/voices/1', expect.anything()));

    expect(fetchMock).not.toHaveBeenCalledWith('/api/videos/7/speakers');
    expect(document.getElementById('speakers-section').innerHTML).toBe('');
  });
});
