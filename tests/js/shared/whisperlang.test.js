// Pure transcription-language <option> builder shared by web Settings and the
// Electron setup wizard (static/shared/whisperlang.js). No fetch, no config: it
// takes a list of language codes and returns the <option> HTML. The wizard smoke
// (tests/ui/test_ui_wizard.py) only checks the first option renders live; the
// sort/escape/empty-input logic is pinned here.
import { languageOptionsHtml } from '../../../yuu_clip/web/static/shared/whisperlang.js';

// Read the value attribute of every <option>, in document order.
const optionValues = (html) => {
  const sel = document.createElement('select');
  sel.innerHTML = html;
  return [...sel.options].map((o) => o.value);
};
const optionByValue = (html, value) => {
  const sel = document.createElement('select');
  sel.innerHTML = html;
  return [...sel.options].find((o) => o.value === value) || null;
};

describe('languageOptionsHtml', () => {
  it('always leads with an empty-value Auto-detect option', () => {
    const first = optionByValue(languageOptionsHtml(['en']), '');
    expect(first).not.toBeNull();
    expect(first.textContent).toBe('Auto-detect (recommended)');
    expect(optionValues(languageOptionsHtml(['en']))[0]).toBe('');
  });

  it('sorts languages by English display name, not by input order or code', () => {
    // Input order de, en, fr; display names German, English, French sort to
    // English, French, German -> en, fr, de. This differs from both the input
    // order and a raw code sort (de, en, fr), so it proves the name sort.
    const values = optionValues(languageOptionsHtml(['de', 'en', 'fr']));
    expect(values).toEqual(['', 'en', 'fr', 'de']);
  });

  it('labels each code with its English display name', () => {
    const html = languageOptionsHtml(['fr']);
    expect(optionByValue(html, 'fr').textContent).toBe('French');
  });

  it('returns only the Auto-detect option for an empty list', () => {
    expect(optionValues(languageOptionsHtml([]))).toEqual(['']);
  });

  it('is null-safe: a missing code list yields only Auto-detect', () => {
    expect(optionValues(languageOptionsHtml(null))).toEqual(['']);
    expect(optionValues(languageOptionsHtml(undefined))).toEqual(['']);
  });

  it('falls back to the raw code when no display name is known', () => {
    // A private-use subtag has no English display name; the option must still
    // render with the code as both value and visible label rather than vanishing.
    const html = languageOptionsHtml(['qqq']);
    const opt = optionByValue(html, 'qqq');
    expect(opt).not.toBeNull();
    expect(opt.textContent).toBe('qqq');
  });
});
