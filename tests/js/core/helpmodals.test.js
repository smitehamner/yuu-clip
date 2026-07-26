// The four app-global help/info modals (static/core/helpmodals.js): the
// getting-started model-status banner and the hand-rolled glossary markdown
// renderer + filter. The modal open/close flows and the bundled help docs
// themselves are exercised end to end in Playwright (tests/ui/test_ui_help.py,
// test_ui_settings.py TestGlossaryFilter, test_ui_whisper_prefetch.py
// TestGettingStartedModal) - this file covers the pure/DOM-shell parsing and
// state-machine logic those flows don't isolate case-by-case.
import { _renderGlossaryMd, _filterGlossary, _renderGettingStartedBanner } from '../../../yuu_clip/web/static/core/helpmodals.js';

describe('_renderGlossaryMd', () => {
  it('wraps a ## section and its ### terms in matching divs', () => {
    const html = _renderGlossaryMd('## Section One\n\n### Term A\n\nBody text.\n');
    expect(html).toContain('<div class="glossary-section">');
    expect(html).toContain('<h2');
    expect(html).toContain('Section One');
    expect(html).toContain('<div class="glossary-term">');
    expect(html).toContain('<h3');
    expect(html).toContain('Term A');
    expect(html).toContain('<p style="margin:3px 0">Body text.</p>');
  });

  it('closes every open section/term div, leaving the output balanced', () => {
    // No trailing newline: a trailing '\n' produces one extra blank source line,
    // which renders its own self-closing spacer div unrelated to section/term nesting.
    const html = _renderGlossaryMd('## A\n### One\n### Two\n## B\n### Three');
    // 2 sections + 3 terms opened; an unbalanced parser (e.g. a term left open
    // across a section boundary) would make these counts diverge.
    const opens = (html.match(/<div class="glossary-(section|term)">/g) || []).length;
    const closes = (html.match(/<\/div>/g) || []).length;
    expect(opens).toBe(5);
    expect(closes).toBe(5);
  });

  it('closes the previous term before opening the next one in the same section', () => {
    const html = _renderGlossaryMd('## A\n### One\n### Two\n');
    expect(html).toContain('</h3></div><div class="glossary-term">');
  });

  it('renders a bullet list', () => {
    const html = _renderGlossaryMd('- first\n- second\n');
    expect(html).toContain('<ul');
    expect(html).toContain('<li style="margin:1px 0">first</li>');
    expect(html).toContain('<li style="margin:1px 0">second</li>');
  });

  it('renders a pipe table with a header row, dropping the separator row', () => {
    const html = _renderGlossaryMd('| Term | Code |\n|---|---|\n| Clip | ClipCandidate |\n');
    expect(html).toContain('<table');
    expect(html).toContain('<th');
    expect(html).toContain('Term');
    expect(html).toContain('<td');
    expect(html).toContain('ClipCandidate');
    expect(html).not.toContain('---');
  });

  it('renders a horizontal rule for a --- line', () => {
    expect(_renderGlossaryMd('---\n')).toContain('<hr');
  });

  it('applies inline bold, italic, and code formatting', () => {
    const html = _renderGlossaryMd('**bold** and *italic* and `code`.\n');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
    expect(html).toContain('<code>code</code>');
  });

  it('escapes raw HTML in the source text', () => {
    const html = _renderGlossaryMd('A <script>alert(1)</script> & more.\n');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
  });

  it('returns an empty-ish string for empty input without throwing', () => {
    expect(() => _renderGlossaryMd('')).not.toThrow();
  });
});

describe('_filterGlossary', () => {
  beforeEach(() => {
    document.getElementById('glossary-content').innerHTML = `
      <div class="glossary-section">
        <div class="glossary-term">Highlight reel</div>
      </div>
      <div class="glossary-section">
        <div class="glossary-term">Track layout</div>
      </div>
    `;
  });

  it('hides terms that do not match and shows their section as hidden too', () => {
    _filterGlossary('highlight');
    const [reelTerm, layoutTerm] = document.querySelectorAll('#glossary-content .glossary-term');
    expect(reelTerm.style.display).not.toBe('none');
    expect(layoutTerm.style.display).toBe('none');
    const [reelSection, layoutSection] = document.querySelectorAll('#glossary-content .glossary-section');
    expect(reelSection.style.display).not.toBe('none');
    expect(layoutSection.style.display).toBe('none');
  });

  it('is case-insensitive', () => {
    _filterGlossary('HIGHLIGHT');
    const [reelTerm] = document.querySelectorAll('#glossary-content .glossary-term');
    expect(reelTerm.style.display).not.toBe('none');
  });

  it('shows every term again for a blank query', () => {
    _filterGlossary('highlight');
    _filterGlossary('');
    document.querySelectorAll('#glossary-content .glossary-term').forEach((term) => {
      expect(term.style.display).not.toBe('none');
    });
  });

  it('shows the no-matches message only when nothing matches', () => {
    _filterGlossary('zzz-no-such-term');
    expect(document.getElementById('glossary-no-matches').style.display).not.toBe('none');
    _filterGlossary('highlight');
    expect(document.getElementById('glossary-no-matches').style.display).toBe('none');
  });
});

describe('_renderGettingStartedBanner', () => {
  const bannerHtml = () => document.getElementById('getting-started-model-banner').innerHTML;

  it('tells the user baseline scoring works when the tiers fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
    await _renderGettingStartedBanner();
    expect(bannerHtml()).toMatch(/Baseline scoring is working/);
  });

  it('reports a local model is active when the tier is not lightweight', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      json: () => Promise.resolve({ lightweight: false }),
    })));
    await _renderGettingStartedBanner();
    expect(bannerHtml()).toMatch(/local language model is active/);
  });

  it('points at the live progress banner when a lightweight tier has a model downloading', async () => {
    vi.stubGlobal('fetch', vi.fn((url) => {
      if (String(url).includes('/api/capabilities/tiers')) {
        return Promise.resolve({ json: () => Promise.resolve({ lightweight: true }) });
      }
      return Promise.resolve({ json: () => Promise.resolve({ downloading: true }) });
    }));
    await _renderGettingStartedBanner();
    expect(bannerHtml()).toMatch(/downloading now/);
  });

  it('invites the user to set up a model when the lightweight tier has none downloading', async () => {
    vi.stubGlobal('fetch', vi.fn((url) => {
      if (String(url).includes('/api/capabilities/tiers')) {
        return Promise.resolve({ json: () => Promise.resolve({ lightweight: true }) });
      }
      return Promise.resolve({ json: () => Promise.resolve({ downloading: false, pending_model_id: null }) });
    }));
    await _renderGettingStartedBanner();
    expect(bannerHtml()).toMatch(/normal next step/);
  });

  it('treats a failed download-status fetch as not-downloading rather than throwing', async () => {
    vi.stubGlobal('fetch', vi.fn((url) => {
      if (String(url).includes('/api/capabilities/tiers')) {
        return Promise.resolve({ json: () => Promise.resolve({ lightweight: true }) });
      }
      return Promise.reject(new Error('offline'));
    }));
    await expect(_renderGettingStartedBanner()).resolves.not.toThrow();
    expect(bannerHtml()).toMatch(/normal next step/);
  });

  it('does nothing when the banner element is absent from the DOM', async () => {
    const banner = document.getElementById('getting-started-model-banner');
    banner.remove();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(_renderGettingStartedBanner()).resolves.not.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
