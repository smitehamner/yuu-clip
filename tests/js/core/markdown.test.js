// Pure markdown -> HTML renderer for the in-app Help & Guides viewer
// (static/core/markdown.js). No browser: import and assert on the HTML string.
import { renderMarkdown } from '../../../yuu_clip/web/static/core/markdown.js';

const ONLINE = 'https://github.com/smitehamner/yuu-clip/blob/main/docs/user/OVERVIEW.md';

describe('renderMarkdown headings + TOC', () => {
  it('collects ## and ### into the TOC with GitHub-style slug ids, excluding the # title', () => {
    const { html, toc } = renderMarkdown('# Title\n\n## First\n\n### Sub\n\n## Second\n');
    expect(toc).toEqual([
      { level: 2, text: 'First', id: 'first' },
      { level: 3, text: 'Sub', id: 'sub' },
      { level: 2, text: 'Second', id: 'second' },
    ]);
    // The # title still gets an id (so cross-doc links can target it) but stays out of the TOC.
    expect(html).toContain('<h1 id="title" class="help-h1">Title</h1>');
    expect(html).toContain('<h2 id="first" class="help-h2">First</h2>');
    expect(html).toContain('<h3 id="sub" class="help-h3">Sub</h3>');
  });

  it('slugifies heading text like GitHub (lowercase, punctuation dropped, spaces hyphenated)', () => {
    const { toc } = renderMarkdown('## World Contexts & Characters\n');
    expect(toc[0].id).toBe('world-contexts--characters');
  });

  it('matches GitHub for a spaced-hyphen heading (each space -> one hyphen)', () => {
    // The guides link to `OVERVIEW.md#world-contexts---making-the-scores-...`;
    // the in-app anchor must produce the identical triple-hyphen slug.
    const { toc } = renderMarkdown('## World Contexts - making the scores actually make sense\n');
    expect(toc[0].id).toBe('world-contexts---making-the-scores-actually-make-sense');
  });

  it('strips inline markdown from the slug and suffixes duplicate headings', () => {
    const { toc } = renderMarkdown('## `Setup`\n\n## Setup\n');
    expect(toc.map(t => t.id)).toEqual(['setup', 'setup-1']);
  });
});

describe('renderMarkdown inline', () => {
  it('escapes HTML and renders bold, italic, and code', () => {
    const { html } = renderMarkdown('Use **bold**, *italic*, `code`, and <b> stays literal.');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
    expect(html).toContain('<code>code</code>');
    expect(html).toContain('&lt;b&gt;');
  });

  it('resolves relative links against the doc online URL and opens them in a new tab', () => {
    const walkthroughUrl =
      'https://github.com/smitehamner/yuu-clip/blob/main/docs/user/tutorials/end-to-end-walkthrough.md';
    const { html } = renderMarkdown('See [features](../FEATURES.md) for more.', { onlineUrl: walkthroughUrl });
    expect(html).toContain(
      '<a href="https://github.com/smitehamner/yuu-clip/blob/main/docs/user/FEATURES.md"' +
      ' target="_blank" rel="noopener">features</a>'
    );
  });

  it('keeps absolute links unchanged', () => {
    const { html } = renderMarkdown('[site](https://example.com/x)', { onlineUrl: ONLINE });
    expect(html).toContain('<a href="https://example.com/x" target="_blank" rel="noopener">site</a>');
  });
});

describe('renderMarkdown blocks', () => {
  it('renders unordered and ordered lists', () => {
    const ul = renderMarkdown('- one\n- two\n').html;
    expect(ul).toContain('<ul class="help-ul"><li>one</li><li>two</li></ul>');
    const ol = renderMarkdown('1. first\n2. second\n').html;
    expect(ol).toContain('<ol class="help-ol"><li>first</li><li>second</li></ol>');
  });

  it('renders a pipe table with a header row, dropping the separator', () => {
    const { html } = renderMarkdown('| A | B |\n|---|---|\n| 1 | 2 |\n');
    expect(html).toContain('<table class="help-table"><thead><tr><th>A</th><th>B</th></tr></thead>');
    expect(html).toContain('<tbody><tr><td>1</td><td>2</td></tr></tbody></table>');
    expect(html).not.toContain('---');
  });

  it('renders a single-line blockquote as a callout', () => {
    const { html } = renderMarkdown('> **Note:** careful here.\n');
    expect(html).toContain('<blockquote class="help-quote"><p><strong>Note:</strong> careful here.</p></blockquote>');
  });

  it('renders a horizontal rule', () => {
    expect(renderMarkdown('---\n').html).toContain('<hr class="help-hr">');
  });
});
