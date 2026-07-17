// _parseWeight (static/library/contexts.js) - reads a numeric input, NaN -> null,
// negative clamped to 0. Ported from tests/ui/test_ui_utils.py (TestParseWeight).
import { _parseWeight } from '../../../yuu_clip/web/static/library/contexts.js';

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
