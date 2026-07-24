// Browser-side decoder for the typed SSE job-event protocol (static/core/jobevents.js).
// Driven against the SAME shared/job-events.json decode_fixtures table the Python
// parse_event test uses, so the two decoders cannot diverge. The legacy
// isDoneSentinel/doneError helpers and the __DONE__/prose-string decode paths were
// retired in migration stage 4.
import { decodeEvent } from '../../../yuu_clip/web/static/core/jobevents.js';
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
  it('a bare string decodes as unknown (the legacy prose-line path is gone)', () => {
    expect(decodeEvent('Extracting audio track 1')).toEqual({ kind: 'unknown' });
    expect(decodeEvent('__DONE__')).toEqual({ kind: 'unknown' });
  });
  it('an array payload decodes as unknown', () => {
    expect(decodeEvent([1, 2])).toEqual({ kind: 'unknown' });
  });
  it('a null payload decodes as unknown', () => {
    expect(decodeEvent(null)).toEqual({ kind: 'unknown' });
  });
  it('a legacy __DONE__ object decodes as unknown', () => {
    expect(decodeEvent({ type: '__DONE__', ok: false, error: 'boom' })).toEqual({ kind: 'unknown' });
  });
});
