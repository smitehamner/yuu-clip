// _parseWeight (static/library/contexts.js) - reads a numeric input, NaN -> null,
// negative clamped to 0. Ported from tests/ui/test_ui_utils.py (TestParseWeight).

const streamCalls = [];
vi.mock('../../../yuu_clip/web/static/core/jobs.js', async (importActual) => {
  const actual = await importActual();
  return {
    ...actual,
    streamSSE: vi.fn((url, onDone) => streamCalls.push({ url, onDone })),
    setJobCancel: vi.fn(),
  };
});
const selectClipCalls = [];
vi.mock('../../../yuu_clip/web/static/clips/clips.js', async (importActual) => {
  const actual = await importActual();
  return {
    ...actual,
    selectClip: vi.fn((id) => selectClipCalls.push(id)),
  };
});
vi.mock('../../../yuu_clip/web/static/core/ui.js', async (importActual) => {
  const actual = await importActual();
  return { ...actual, showConfirm: vi.fn() };
});

import { showConfirm } from '../../../yuu_clip/web/static/core/ui.js';
import {
  _parseWeight, openRetranscribeModal, startRetranscribe, groupTermsByContext,
} from '../../../yuu_clip/web/static/library/contexts.js';

describe('_parseWeight', () => {
  const weight = (raw) => {
    const el = document.createElement('input');
    el.id = '__test_weight';
    el.value = raw;
    document.body.appendChild(el);
    const out = _parseWeight('__test_weight');
    el.remove();
    return out;
  };

  it('parses a positive value', () => {
    expect(weight('2.5')).toBe(2.5);
  });
  it('blank or non-numeric is null', () => {
    expect(weight('')).toBe(null);
    expect(weight('abc')).toBe(null);
  });
  it('a negative weight is clamped to 0', () => {
    expect(weight('-5')).toBe(0);
  });
});

describe('groupTermsByContext', () => {
  const contexts = [
    { context_id: 'pkmn', display_name: 'Pokemon' },
    { context_id: 'zelda', display_name: 'Zelda' },
  ];
  const term = (word, slug) => ({ word, context_slug: slug });
  const shape = (groups) => groups.map(g => [g.key, g.label, g.rows.map(r => r.word)]);

  it('puts Global first, then contexts in the context-list order', () => {
    const groups = groupTermsByContext(
      [term('z', 'zelda'), term('g', null), term('p', 'pkmn')],
      contexts,
    );
    expect(shape(groups)).toEqual([
      ['', 'Global (all recordings)', ['g']],
      ['pkmn', 'Pokemon', ['p']],
      ['zelda', 'Zelda', ['z']],
    ]);
  });

  it('emits no Global group when nothing is global-scoped', () => {
    const groups = groupTermsByContext([term('p', 'pkmn')], contexts);
    expect(groups.map(g => g.key)).toEqual(['pkmn']);
  });

  it('buckets an orphaned slug into its own (removed) group, last', () => {
    const groups = groupTermsByContext(
      [term('g', null), term('x', 'deleted-ctx')],
      contexts,
    );
    expect(shape(groups)).toEqual([
      ['', 'Global (all recordings)', ['g']],
      ['deleted-ctx', 'deleted-ctx (removed)', ['x']],
    ]);
  });

  it('groups multiple terms under one context in encounter order', () => {
    const groups = groupTermsByContext(
      [term('a', 'pkmn'), term('b', 'pkmn')],
      contexts,
    );
    expect(groups[0].rows.map(r => r.word)).toEqual(['a', 'b']);
  });

  it('is empty-safe on both inputs', () => {
    expect(groupTermsByContext([], [])).toEqual([]);
    expect(groupTermsByContext([], null)).toEqual([]);
  });

  it('falls back to the context_id when a context has no display_name', () => {
    const groups = groupTermsByContext([term('p', 'raw')], [{ context_id: 'raw' }]);
    expect(groups[0].label).toBe('raw');
  });
});

describe('startRetranscribe completion targeting', () => {
  beforeEach(() => {
    streamCalls.length = 0;
    selectClipCalls.length = 0;
    // openRetranscribeModal fires _loadRetranscribeSpeakerDefault's readiness
    // fetch in the background; startRetranscribe preflights the model-cached
    // check - stub both so no real request escapes happy-dom, and the model
    // reads as already cached so the job starts without a confirm detour.
    globalThis.fetch = vi.fn((url) =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(
        String(url).includes('/api/whisper/model-cached') ? { cached: true } : {},
      ) }));
  });

  it('onDone selects the clip the job STARTED for, not a later-opened one', async () => {
    // Regression: onDone read the module-level id at completion time, so
    // opening the modal for clip B mid-job made clip A's finish select B.
    openRetranscribeModal(1);
    await startRetranscribe();
    expect(streamCalls).toHaveLength(1);
    expect(streamCalls[0].url).toContain('/api/clips/1/retranscribe');

    openRetranscribeModal(2);  // browse another clip's modal while job 1 runs
    streamCalls[0].onDone();
    expect(selectClipCalls).toEqual([1]);
  });
});

describe('startRetranscribe download preflight', () => {
  beforeEach(() => {
    streamCalls.length = 0;
    showConfirm.mockClear();
  });

  it('confirms before downloading an uncached model instead of starting immediately', async () => {
    globalThis.fetch = vi.fn((url) =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(
        String(url).includes('/api/whisper/model-cached') ? { cached: false } : {},
      ) }));
    openRetranscribeModal(1);
    await startRetranscribe();
    expect(streamCalls).toHaveLength(0);
    expect(showConfirm).toHaveBeenCalledTimes(1);
    const [title, body] = showConfirm.mock.calls[0];
    expect(title).toBe('Download speech model?');
    expect(body).toContain('download');
  });

  it('confirming the download starts the retranscribe job', async () => {
    globalThis.fetch = vi.fn((url) =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(
        String(url).includes('/api/whisper/model-cached') ? { cached: false } : {},
      ) }));
    openRetranscribeModal(1);
    await startRetranscribe();
    const onOk = showConfirm.mock.calls[0][3];
    onOk();
    expect(streamCalls).toHaveLength(1);
    expect(streamCalls[0].url).toContain('/api/clips/1/retranscribe');
  });
});
