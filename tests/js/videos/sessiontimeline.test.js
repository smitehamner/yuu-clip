// Pure session-timeline merge + gap formatting extracted from static/videos/sessions.js
// (mergeTimelineEntries / _fmtGap). The row HTML (_timelineRowHtml) and the click-to-nav
// wiring stay in tests/ui/test_ui_sessions.py.
import {
  mergeTimelineEntries, _fmtGap,
} from '../../../yuu_clip/web/static/videos/sessions.js';

describe('mergeTimelineEntries', () => {
  const entry = (abs, over = {}) => ({ abs_ms: abs, local_ms: abs, text: `t${abs}`, ...over });
  const clip = (abs, over = {}) => ({ abs_ms: abs, id: abs, description: `c${abs}`, score_overall: 0.5, ...over });

  it('interleaves entries and clips sorted by absolute time', () => {
    const rows = mergeTimelineEntries(
      [entry(3000), entry(1000)],
      [clip(2000), clip(4000)],
    );
    expect(rows.map(r => [r.kind, r.abs])).toEqual([
      ['text', 1000], ['clip', 2000], ['text', 3000], ['clip', 4000],
    ]);
  });

  it('keeps text vs clip source fields on the plain rows', () => {
    const [textRow] = mergeTimelineEntries([entry(1000)], []);
    expect(textRow).toEqual({ kind: 'text', abs: 1000, localMs: 1000, text: 't1000' });
    const [clipRow] = mergeTimelineEntries([], [clip(1000)]);
    expect(clipRow).toEqual({ kind: 'clip', abs: 1000, id: 1000, description: 'c1000', scoreOverall: 0.5 });
  });

  it('is empty-safe on both inputs', () => {
    expect(mergeTimelineEntries([], [])).toEqual([]);
  });

  it('keeps a stable interleave when a text entry and a clip share a timestamp', () => {
    // sort is stable, and text entries are pushed before clips, so a tie keeps text first.
    const rows = mergeTimelineEntries([entry(1000)], [clip(1000)]);
    expect(rows.map(r => r.kind)).toEqual(['text', 'clip']);
  });
});

describe('_fmtGap', () => {
  it('renders whole minutes under an hour', () => {
    expect(_fmtGap(5 * 60_000)).toBe('5 mins');
    expect(_fmtGap(60_000)).toBe('1 min');
  });

  it('renders hours and minutes at or over an hour', () => {
    expect(_fmtGap(90 * 60_000)).toBe('1h 30m');
  });

  it('drops the minutes and pluralizes hours on an exact hour', () => {
    expect(_fmtGap(120 * 60_000)).toBe('2 hrs');
    expect(_fmtGap(60 * 60_000)).toBe('1 hr');
  });
});
