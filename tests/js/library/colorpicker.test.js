// _normalizeHex (static/library/colorpicker.js) - the pure hex-canonicalization
// behind the colour picker. Ported from the hex-normalization cases in
// tests/ui/test_ui_colorpicker.py; the popover interaction / focus-trap / reload
// cases need a real browser and stay in Playwright.
import { ColorPicker } from '../../../yuu_clip/web/static/library/colorpicker.js';

const { _normalizeHex } = ColorPicker;

describe('_normalizeHex', () => {
  it('normalizes a 6-digit hex to lowercase with a leading #', () => {
    expect(_normalizeHex('ABCDEF')).toBe('#abcdef');
    expect(_normalizeHex('#AbCdEf')).toBe('#abcdef');
  });
  it('expands shorthand #RGB to #rrggbb', () => {
    expect(_normalizeHex('ABC')).toBe('#aabbcc');
  });
  it('rejects a non-hex value as null', () => {
    expect(_normalizeHex('nothex')).toBe(null);
  });
  it('rejects non-strings as null', () => {
    expect(_normalizeHex(null)).toBe(null);
    expect(_normalizeHex(undefined)).toBe(null);
  });
});
