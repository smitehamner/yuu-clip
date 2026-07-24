// Browser-side decoder for the typed SSE job-event protocol (static/core/jobevents.js).
// Driven against the SAME shared/job-events.json decode_fixtures table the Python
// parse_event test uses, so the two decoders cannot diverge. Plus the legacy
// isDoneSentinel/doneError helpers re-exported for the hand-rolled stream readers.
import {
  decodeEvent, isDoneSentinel, doneError,
} from '../../../yuu_clip/web/static/core/jobevents.js';
import contract from '../../../yuu_clip/web/static/shared/job-events.json';

describe('decodeEvent against the shared decode_fixtures', () => {
  it('has a non-empty fixture table', () => {
    expect(contract.decode_fixtures.length).toBeGreaterThan(0);
  });
  for (const fixture of contract.decode_fixtures) {
    it(fixture.name, () => {
      expect(decodeEvent(fixture.payload)).toEqual(fixture.expected);
    });
  }
});

describe('decodeEvent edge inputs (not on the wire, but must not throw)', () => {
  it('an array payload decodes as a legacy line', () => {
    expect(decodeEvent([1, 2])).toEqual({ kind: 'legacy-line', payload: [1, 2] });
  });
  it('a null payload decodes as a legacy line', () => {
    expect(decodeEvent(null)).toEqual({ kind: 'legacy-line', payload: null });
  });
});

// The two hand-rolled readers still import these from jobs.js (which re-exports them),
// so their behavior is pinned here as well as in tests/js/core/jobs.test.js.
describe('legacy sentinel helpers', () => {
  it('recognises both the success string and the failure object', () => {
    expect(isDoneSentinel('__DONE__')).toBe(true);
    expect(isDoneSentinel({ type: '__DONE__', ok: false, error: 'boom' })).toBe(true);
    expect(isDoneSentinel('a log line')).toBe(false);
    expect(isDoneSentinel({ type: 'progress' })).toBe(false);
  });
  it('reports the failure message only for the ok:false form, with a default fallback', () => {
    expect(doneError({ type: '__DONE__', ok: false, error: 'boom' })).toBe('boom');
    expect(doneError('__DONE__')).toBe(null);
    expect(doneError({ type: '__DONE__' })).toBe(null);
    expect(doneError({ type: '__DONE__', ok: false }))
      .toBe('The job did not finish - check the log for details.');
  });
});
