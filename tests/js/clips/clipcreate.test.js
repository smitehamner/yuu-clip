// _ccParseTimeToMs / _ccFmt / _ccPickLine (static/clips/clipcreate.js) - the pure
// time-parsing/formatting helpers and the click-a-transcript-line range-picking rule
// behind the manual clip/scene picker. Flagged as an untested-and-unexported gap in
// REVIEW_OPEN_ITEMS.md (Section 8) - exporting them is a behavior-neutral change. The
// panel mount/create/PanelNav flow stays covered by tests/ui/test_ui_clipcreate.py.
import {
  _ccParseTimeToMs, _ccFmt, _ccPickLine,
} from '../../../yuu_clip/web/static/clips/clipcreate.js';

describe('_ccParseTimeToMs', () => {
  it('parses h:mm:ss', () => {
    expect(_ccParseTimeToMs('1:02:03')).toBe(3723000);
  });

  it('parses m:ss', () => {
    expect(_ccParseTimeToMs('2:03')).toBe(123000);
  });

  it('parses a bare seconds count', () => {
    expect(_ccParseTimeToMs('45')).toBe(45000);
  });

  it('rounds fractional seconds to the nearest millisecond', () => {
    expect(_ccParseTimeToMs('1:02.5')).toBe(62500);
  });

  it('rejects non-numeric input', () => {
    expect(_ccParseTimeToMs('abc')).toBeNull();
    expect(_ccParseTimeToMs('1:ab')).toBeNull();
  });

  it('rejects more than three colon-separated parts', () => {
    expect(_ccParseTimeToMs('1:02:03:04')).toBeNull();
  });

  it('treats empty/missing input as zero rather than rejecting it', () => {
    expect(_ccParseTimeToMs('')).toBe(0);
    expect(_ccParseTimeToMs(undefined)).toBe(0);
  });
});

describe('_ccFmt', () => {
  it('formats sub-hour durations as m:ss', () => {
    expect(_ccFmt(65000)).toBe('1:05');
    expect(_ccFmt(0)).toBe('0:00');
  });

  it('formats hour-or-longer durations as h:mm:ss', () => {
    expect(_ccFmt(3723000)).toBe('1:02:03');
  });

  it('treats a missing/null value as zero', () => {
    expect(_ccFmt(null)).toBe('0:00');
    expect(_ccFmt(undefined)).toBe('0:00');
  });

  it('round-trips through _ccParseTimeToMs for a representative value', () => {
    expect(_ccFmt(_ccParseTimeToMs('1:02:03'))).toBe('1:02:03');
  });
});

// _ccPickLine mutates clipcreate.js's own module-level start/end state and then
// re-renders the (guarded-optional) header DOM - so each test re-imports a fresh
// module instance to start from a known "nothing picked yet" state rather than
// leaking selection state across tests.
describe('_ccPickLine', () => {
  let pickLine;

  beforeEach(async () => {
    document.body.innerHTML = `
      <div id="clipcreate-range-header"></div>
      <button id="clipcreate-play-btn"></button>
      <button id="clipcreate-confirm-btn"></button>
      <input id="clipcreate-start-input">
      <input id="clipcreate-end-input">
      <div id="clipcreate-transcript-view"></div>
    `;
    vi.resetModules();
    ({ _ccPickLine: pickLine } = await import('../../../yuu_clip/web/static/clips/clipcreate.js'));
  });

  const header = () => document.getElementById('clipcreate-range-header').textContent;
  const confirmDisabled = () => document.getElementById('clipcreate-confirm-btn').disabled;

  it('the first pick sets the start and leaves the end open', () => {
    pickLine(60000, 65000);
    expect(header()).toBe('Start 1:00 - pick an end');
    expect(confirmDisabled()).toBe(true);
  });

  it('a later pick after a start sets the end and enables Create', () => {
    pickLine(60000, 65000);
    pickLine(120000, 125000);
    expect(header()).toBe('1:00 - 2:05 (65s)');
    expect(confirmDisabled()).toBe(false);
  });

  it('picking the same line twice yields a 1-line clip', () => {
    pickLine(60000, 65000);
    pickLine(60000, 65000);
    expect(header()).toBe('1:00 - 1:05 (5s)');
  });

  it('picking an earlier line than the current start restarts the range', () => {
    pickLine(120000, 125000);
    pickLine(60000, 65000);
    expect(header()).toBe('Start 1:00 - pick an end');
    expect(confirmDisabled()).toBe(true);
  });
});
