// Pure split-time parsing/formatting and suggestion-pin computation in
// static/analyze/split.js. Ported from tests/ui/test_ui_utils.py. computeSuggestionPins
// was refactored to a pure (energyFlat, durationS) -> pins helper during the port, so
// these no longer poke the module's live-state accessor bridge.
import {
  _parseSplitTime, _fmtSplitTime, computeSuggestionPins, segmentsFromSplitPoints,
} from '../../../yuu_clip/web/static/analyze/split.js';

describe('_parseSplitTime', () => {
  it('parses m:ss', () => { expect(_parseSplitTime('2:05')).toBe(125); });
  it('parses h:mm:ss', () => { expect(_parseSplitTime('1:02:03')).toBe(3723); });
  it('parses bare seconds', () => { expect(_parseSplitTime('42')).toBe(42); });
  it('a non-numeric part yields null, not NaN', () => {
    expect(_parseSplitTime('1:ab')).toBe(null);
  });
});

describe('_fmtSplitTime', () => {
  it('pads the seconds in m:ss', () => { expect(_fmtSplitTime(125)).toBe('2:05'); });
  it('renders h:mm:ss above one hour', () => { expect(_fmtSplitTime(3723)).toBe('1:02:03'); });
  it('round-trips through parse and format', () => {
    const rt = ['0:30', '9:59', '1:00:00', '2:34:56'].map((s) => _fmtSplitTime(_parseSplitTime(s)));
    expect(rt).toEqual(['0:30', '9:59', '1:00:00', '2:34:56']);
  });
});

describe('segmentsFromSplitPoints', () => {
  const kinds = (segs) => segs.map(s => [s.index, s.start, s.end, s.ignored, s.isFirst, s.isLast]);

  it('no split points is one full-duration segment (both first and last)', () => {
    expect(kinds(segmentsFromSplitPoints([], 100, new Set()))).toEqual([
      [0, 0, 100, false, true, true],
    ]);
  });

  it('n split points make n+1 consecutive segments spanning 0..duration', () => {
    const segs = segmentsFromSplitPoints([30, 70], 100, new Set());
    expect(kinds(segs)).toEqual([
      [0, 0, 30, false, true, false],
      [1, 30, 70, false, false, false],
      [2, 70, 100, false, false, true],
    ]);
  });

  it('propagates the ignored flag by segment index', () => {
    const segs = segmentsFromSplitPoints([30, 70], 100, new Set([1]));
    expect(segs.map(s => s.ignored)).toEqual([false, true, false]);
  });

  it('only the first/last segments carry the fixed-boundary flags', () => {
    const segs = segmentsFromSplitPoints([50], 100, new Set());
    expect(segs.map(s => [s.isFirst, s.isLast])).toEqual([[true, false], [false, true]]);
  });
});

describe('computeSuggestionPins', () => {
  const flat = (length, quietAt) =>
    Array.from({ length }, (_, i) => ({ second: i, rms_db: quietAt(i) ? -90 : -10 }));
  const spaced = (pins) => pins.every((p, i) => i === 0 || p - pins[i - 1] >= 30);

  it('picks the clear quiet valleys, capped and spaced', () => {
    const pins = computeSuggestionPins(flat(200, (i) => i === 50 || i === 150), 200);
    expect(pins).toContain(50);
    expect(pins).toContain(150);
    expect(pins.length).toBeLessThanOrEqual(8);
    expect(spaced(pins)).toBe(true);
  });
  it('respects the 30s min gap (earlier valley wins)', () => {
    const pins = computeSuggestionPins(flat(200, (i) => i === 50 || i === 60), 200);
    expect(pins).toContain(50);
    expect(pins).not.toContain(60);
    expect(spaced(pins)).toBe(true);
  });
  it('excludes the endpoints (0 and duration)', () => {
    const pins = computeSuggestionPins(flat(101, (i) => i === 0 || i === 100), 100);
    expect(pins).not.toContain(0);
    expect(pins).not.toContain(100);
  });
  it('caps at the suggestion count', () => {
    const pins = computeSuggestionPins(flat(1000, (i) => i % 40 === 0 && i > 0), 1000);
    expect(pins.length).toBeLessThanOrEqual(8);
  });
  it('returns pins sorted ascending', () => {
    const pins = computeSuggestionPins(flat(300, (i) => [40, 120, 200, 280].includes(i)), 300);
    expect(pins).toEqual([...pins].sort((a, b) => a - b));
  });
  it('all-equal energy still yields spaced, in-bounds pins (no divide-by-zero)', () => {
    const pins = computeSuggestionPins(flat(300, () => false), 300);
    expect(pins.length).toBeGreaterThan(0);
    expect(pins.every((p) => p > 0 && p < 300)).toBe(true);
    expect(spaced(pins)).toBe(true);
    expect(pins.length).toBeLessThanOrEqual(8);
  });
  it('returns null for empty energy (caller leaves existing pins untouched)', () => {
    expect(computeSuggestionPins([], 200)).toBe(null);
  });
  it('returns null for zero duration', () => {
    expect(computeSuggestionPins([{ second: 1, rms_db: -10 }], 0)).toBe(null);
  });
});
