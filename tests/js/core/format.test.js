// Pure formatters / score helpers in static/core/format.js. Ported from the
// page.evaluate cases in tests/ui/test_ui_utils.py - imported directly here, no
// browser. Assertions that depend on the host clock/timezone stay engine-relative
// (compare two values computed the same way) exactly as the Playwright versions did.
import {
  escHtml, _parseServerDate, _fmtAgo, _fmtOffset, _msToHms, finiteOr, fmtDuration,
  formatApiError, stripRichMarkup, _scoreBorderColor, _lerpColor, _fmtElapsed,
  _fmtVideoStatus, _fmtDate, _sortScore, plural, _parseIntervalS, stripQuotedPath, fmtClock,
} from '../../../yuu_clip/web/static/core/format.js';
import { registerRefreshHooks, _resetRefreshHooks } from '../../../yuu_clip/web/static/core/refreshhooks.js';

describe('escHtml', () => {
  it('escapes the double-quote for data-*/title attributes', () => {
    expect(escHtml('a "b" <c> & d')).toBe('a &quot;b&quot; &lt;c&gt; &amp; d');
  });
});

describe('_parseServerDate', () => {
  it('treats a naive (zone-less) timestamp as UTC', () => {
    expect(_parseServerDate('2026-06-29T12:00:00').getTime())
      .toBe(_parseServerDate('2026-06-29T12:00:00Z').getTime());
  });
  it('keeps an explicit offset (no spurious appended Z)', () => {
    const offset = _parseServerDate('2026-06-29T12:00:00+02:00').getTime();
    const utc = _parseServerDate('2026-06-29T10:00:00Z').getTime();
    expect(Number.isFinite(offset)).toBe(true);
    expect(offset).toBe(utc);
  });
});

describe('_fmtAgo', () => {
  it('uses UTC for a naive ~2h-old timestamp', () => {
    const d = new Date(Date.now() - 2 * 3600 * 1000);
    const naive = d.toISOString().replace(/\.\d+Z$/, '');
    expect(_fmtAgo(naive)).toBe('2h ago');
  });
});

describe('_fmtOffset', () => {
  it('renders zero as +0.0 and keeps the sign', () => {
    expect([_fmtOffset(0), _fmtOffset(1.2), _fmtOffset(-3.5)]).toEqual(['+0.0', '+1.2', '-3.5']);
  });
});

describe('_msToHms', () => {
  it('formats minutes with zero-padded seconds', () => {
    expect([_msToHms(5000), _msToHms(65000)]).toEqual(['5s', '1m 05s']);
  });
});

describe('fmtClock', () => {
  it('renders m:ss under an hour and h:mm:ss past it', () => {
    expect(fmtClock(5000)).toBe('0:05');
    expect(fmtClock(65000)).toBe('1:05');
    expect(fmtClock(3_725_000)).toBe('1:02:05');
  });
  it('clamps a negative or missing timestamp to 0:00', () => {
    expect(fmtClock(-500)).toBe('0:00');
    expect(fmtClock(undefined)).toBe('0:00');
  });
});

describe('finiteOr', () => {
  it('returns finite values including 0', () => {
    expect(finiteOr(42)).toBe(42);
    expect(finiteOr(0)).toBe(0);
  });
  it('falls back for non-finite / non-numbers', () => {
    expect([finiteOr(NaN), finiteOr(Infinity), finiteOr(undefined), finiteOr(NaN, 'n/a')])
      .toEqual(['N/A', 'N/A', 'N/A', 'n/a']);
  });
});

describe('fmtDuration', () => {
  it('formats seconds and minutes', () => {
    expect([fmtDuration(30), fmtDuration(90), fmtDuration(0)]).toEqual(['30 sec', '2 min', '0 sec']);
  });
  it('falls back for non-finite', () => {
    expect([fmtDuration(NaN), fmtDuration(Infinity, 'n/a')]).toEqual(['unknown', 'n/a']);
  });
});

describe('formatApiError', () => {
  it('null -> Unknown error', () => {
    expect(formatApiError(null)).toBe('Unknown error');
  });
  it('string detail passes through', () => {
    expect(formatApiError({ detail: 'File not found' })).toBe('File not found');
  });
  it('array detail joins the messages', () => {
    expect(formatApiError({ detail: [{ msg: 'field required' }, { msg: 'too long' }] }))
      .toBe('field required; too long');
  });
  it('array entry without msg falls back to JSON', () => {
    expect(formatApiError({ detail: [{ code: 7 }] })).toBe('{"code":7}');
  });
  it('object without detail uses message', () => {
    expect(formatApiError({ message: 'boom' })).toBe('boom');
  });
  it('object without detail or message stringifies', () => {
    expect(formatApiError({ status: 500 })).toBe('{"status":500}');
  });
  it('empty object returns a readable fallback', () => {
    expect(formatApiError({})).toBe('Unknown error (no details from server)');
  });
});

describe('stripRichMarkup', () => {
  it('removes ANSI escape codes', () => {
    expect(stripRichMarkup('\x1b[32mdone\x1b[0m')).toBe('done');
  });
  it('removes rich markup tags', () => {
    expect(stripRichMarkup('[green]OK[/green] and [bold]bold[/bold]')).toBe('OK and bold');
  });
  it('leaves plain text unchanged', () => {
    expect(stripRichMarkup('just plain text 12:34')).toBe('just plain text 12:34');
  });
});

// Ported from tests/ui/test_ui_terminology.py (TestPluralHelper). The static-file
// terminology scans in that module stay Python (they read the served files).
describe('plural', () => {
  it('keeps the singular for a count of 1', () => {
    expect(plural(1, 'clip')).toBe('1 clip');
  });
  it('pluralizes for other counts, including zero', () => {
    expect(plural(3, 'clip')).toBe('3 clips');
    expect(plural(0, 'clip')).toBe('0 clips');
  });
  it('uses an explicit irregular plural form', () => {
    expect(plural(2, 'entry', 'entries')).toBe('2 entries');
  });
  it('appends s to a multi-word noun', () => {
    expect(plural(2, 'audio track')).toBe('2 audio tracks');
  });
});

describe('_scoreBorderColor / _lerpColor', () => {
  it('rejected is muted regardless of score', () => {
    expect(_scoreBorderColor(0.95, true)).toBe('var(--muted)');
  });
  it('a stop boundary is the exact stop colour', () => {
    expect(_scoreBorderColor(0.3, false)).toBe('rgb(79,195,247)');
  });
  it('top of range is the final stop', () => {
    expect(_scoreBorderColor(1.0, false)).toBe('rgb(247,168,90)');
  });
  it('a midpoint blends strictly between the two stops', () => {
    const parse = (s) => s.match(/\d+/g).map(Number);
    const lo = parse(_scoreBorderColor(0.3, false));
    const mid = parse(_scoreBorderColor(0.4, false));
    const hi = parse(_scoreBorderColor(0.5, false));
    expect(mid.every((v, i) => v >= Math.min(lo[i], hi[i]) && v <= Math.max(lo[i], hi[i]))).toBe(true);
    expect(mid.join() !== lo.join() && mid.join() !== hi.join()).toBe(true);
  });
  it('lerp endpoints are exact', () => {
    expect([
      _lerpColor('#000000', '#ffffff', 0),
      _lerpColor('#000000', '#ffffff', 1),
      _lerpColor('#000000', '#ffffff', 0.5),
    ]).toEqual(['rgb(0,0,0)', 'rgb(255,255,255)', 'rgb(128,128,128)']);
  });
});

// Shared by the Settings save path and the per-video timeline generator, so their
// validation cannot drift apart. Minutes scale to seconds; anything below the 10s
// floor or non-numeric is rejected as null.
describe('_parseIntervalS', () => {
  it('passes seconds straight through', () => {
    expect(_parseIntervalS('30', 'seconds')).toBe(30);
  });
  it('scales minutes to seconds', () => {
    expect(_parseIntervalS('2', 'minutes')).toBe(120);
  });
  it('accepts exactly the 10s floor', () => {
    expect(_parseIntervalS('10', 'seconds')).toBe(10);
  });
  it('rejects a value below the 10s floor as null', () => {
    expect(_parseIntervalS('5', 'seconds')).toBe(null);
  });
  it('rejects a non-numeric value as null', () => {
    expect(_parseIntervalS('abc', 'seconds')).toBe(null);
  });
  it('treats any non-minutes unit as seconds', () => {
    expect(_parseIntervalS('15', 'seconds')).toBe(15);
  });
});

// Windows Explorer's "Copy as path" wraps the clipboard value in double quotes;
// strip exactly one matching pair, leaving an unbalanced/mismatched quote alone
// rather than guessing at malformed input (B26).
describe('stripQuotedPath', () => {
  it('strips a matching double-quote pair', () => {
    expect(stripQuotedPath('"D:\\Videos\\my-project"')).toBe('D:\\Videos\\my-project');
  });
  it('strips a matching single-quote pair', () => {
    expect(stripQuotedPath("'/home/user/videos'")).toBe('/home/user/videos');
  });
  it('leaves a path with no quotes unchanged', () => {
    expect(stripQuotedPath('D:\\Videos\\my-project')).toBe('D:\\Videos\\my-project');
  });
  it('leaves an unbalanced leading quote alone', () => {
    expect(stripQuotedPath('"D:\\Videos\\my-project')).toBe('"D:\\Videos\\my-project');
  });
  it('leaves an unbalanced trailing quote alone', () => {
    expect(stripQuotedPath('D:\\Videos\\my-project"')).toBe('D:\\Videos\\my-project"');
  });
  it('leaves mismatched quote types alone', () => {
    expect(stripQuotedPath('"D:\\Videos\\my-project\'')).toBe('"D:\\Videos\\my-project\'');
  });
  it('handles empty and single-character input without stripping', () => {
    expect(stripQuotedPath('')).toBe('');
    expect(stripQuotedPath('"')).toBe('"');
  });
  it('passes non-string input through unchanged', () => {
    expect(stripQuotedPath(null)).toBe(null);
  });
});

describe('_fmtElapsed', () => {
  it('under a minute is seconds only', () => {
    expect([_fmtElapsed(0), _fmtElapsed(5000), _fmtElapsed(59000)]).toEqual(['0s', '5s', '59s']);
  });
  it('the seconds part is not zero-padded past the minute', () => {
    expect([_fmtElapsed(60000), _fmtElapsed(65000)]).toEqual(['1m 0s', '1m 5s']);
  });
  it('has no hour rollover', () => {
    expect(_fmtElapsed(3661000)).toBe('61m 1s');
  });
});

describe('_fmtVideoStatus', () => {
  it('maps known statuses to display labels', () => {
    expect([_fmtVideoStatus('done'), _fmtVideoStatus('pending'), _fmtVideoStatus('transcribed')])
      .toEqual(['Analyzed', 'Not analyzed', 'Transcribed']);
  });
  it('an unknown status falls through to raw', () => {
    expect(_fmtVideoStatus('frobnicate')).toBe('frobnicate');
  });
});

describe('_fmtDate', () => {
  it('missing is "never"', () => {
    expect([_fmtDate(null), _fmtDate('')]).toEqual(['never', 'never']);
  });
  it('a valid date uses the " at " separator', () => {
    expect(_fmtDate('2026-06-29T12:00:00')).toContain(' at ');
  });
  it('distinct inputs format distinctly', () => {
    expect(_fmtDate('2026-06-29T12:00:00') !== _fmtDate('2026-01-02T08:30:00')).toBe(true);
  });
});

// _sortScore reaches back into videos.js's sort control via the refreshhooks.js
// registration seam (format.js is a leaf yet needs the current sort dimension; a
// direct import would break vitest vi.mock resolution - see core/refreshhooks.js).
// We register the same accessor boot.js wires in production.
describe('_sortScore', () => {
  const clip = { score_overall: 0.5, score_funny: 0.9, score_dramatic: 0.4, score_action: 0.3 };
  const sortBy = (v) => {
    document.getElementById('clips-sort').value = v;
    return _sortScore(clip);
  };
  beforeEach(() => {
    const opts = ['funny', 'dramatic', 'action', 'score', 'timeline']
      .map((v) => `<option value="${v}">${v}</option>`).join('');
    document.body.innerHTML = `<select id="clips-sort">${opts}</select>`;
    registerRefreshHooks({ clipsSortParam: () => document.getElementById('clips-sort').value });
  });
  afterEach(() => { _resetRefreshHooks(); });
  it('a dimension selects the matching field', () => {
    expect(sortBy('funny')).toBe(0.9);
    expect(sortBy('dramatic')).toBe(0.4);
    expect(sortBy('action')).toBe(0.3);
  });
  it('"score" uses overall', () => {
    expect(sortBy('score')).toBe(0.5);
  });
  it('a non-dimension sort falls back to overall', () => {
    expect(sortBy('timeline')).toBe(0.5);
  });
});
