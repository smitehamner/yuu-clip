// Suggestion-display gating in the Speakers card (static/people/speakers.js).
// The server now filters bogus "Speaker N" name suggestions, but this frontend guard
// also hides any already written to the DB by an older run so they stop showing.
import { _isSuggestion } from '../../../yuu_clip/web/static/people/speakers.js';

describe('_isSuggestion', () => {
  const base = { source: 'inferred', confirmed: false, name: 'Alice' };

  it('is a suggestion for an unconfirmed inferred real name', () => {
    expect(_isSuggestion(base)).toBe(true);
  });

  it('hides a "Speaker N" placeholder echoed as a name', () => {
    expect(_isSuggestion({ ...base, name: 'Speaker 55' })).toBe(false);
    expect(_isSuggestion({ ...base, name: '  speaker 2 ' })).toBe(false);
  });

  it('is not a suggestion once confirmed or when there is no name', () => {
    expect(_isSuggestion({ ...base, confirmed: true })).toBe(false);
    expect(_isSuggestion({ ...base, name: '' })).toBe(false);
  });
});
