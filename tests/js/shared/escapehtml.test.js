// Direct assertions on the shared HTML escaper (static/shared/escapehtml.js) - the
// module both the web bundle and the Electron wizard import. format.js re-exports it,
// but this pins the CLAUDE.md contract (& < > and especially " -> &quot;) at its source.
import { escHtml } from '../../../yuu_clip/web/static/shared/escapehtml.js';

describe('escHtml', () => {
  it('escapes the double-quote so a value is safe inside a "..."-quoted attribute', () => {
    expect(escHtml('say "hi"')).toBe('say &quot;hi&quot;');
  });

  it('escapes all four entities in one pass', () => {
    expect(escHtml('a & b < c > d "e"')).toBe('a &amp; b &lt; c &gt; d &quot;e&quot;');
  });

  it('escapes the ampersand first so an entity is not double-escaped', () => {
    expect(escHtml('<')).toBe('&lt;');
    expect(escHtml('&lt;')).toBe('&amp;lt;');
  });

  it('coerces non-string input through String() rather than throwing', () => {
    expect(escHtml(42)).toBe('42');
    expect(escHtml(null)).toBe('null');
    expect(escHtml(undefined)).toBe('undefined');
  });

  it('leaves a safe string untouched', () => {
    expect(escHtml('plain text 123')).toBe('plain text 123');
  });
});
