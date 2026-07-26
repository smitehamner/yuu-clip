// Minimal markdown -> HTML for the in-app doc viewer (Help & Guides modal).
// Modeled on the glossary modal's renderer in helpmodals.js, but generalized: it
// emits heading anchors + a table-of-contents and resolves the guides' relative
// cross-links to their online GitHub targets so an in-app link never dead-ends.
//
// The user guides are authored in a known markdown subset - headings (# ## ###),
// un/ordered lists, pipe tables, single-line blockquotes, bold/italic/code, links,
// and `---` rules, with no code fences or nested lists - so this is deliberately
// not a full CommonMark parser.

// GitHub-style heading slug: strip inline markdown, lowercase, drop punctuation,
// spaces -> hyphens. Matches the anchors the guides use in cross-doc links
// (e.g. OVERVIEW.md#world-contexts) so a fragment resolves to the right heading.
function slugify(text) {
  const plain = text
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  // Mirror GitHub's gh-slugger exactly (each space -> one hyphen, no collapsing,
  // existing hyphens kept) so a source anchor like `#world-contexts---...` lands.
  return plain
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s/g, '-');
}

function uniqueSlug(text, seen) {
  const base = slugify(text) || 'section';
  const count = seen.get(base) || 0;
  seen.set(base, count + 1);
  return count === 0 ? base : `${base}-${count}`;
}

// Escape HTML then apply the inline emphasis subset (code/bold/italic) the doc
// viewer and the glossary renderer (helpmodals.js) both use. Links are layered on
// top by inlineMd, since only the doc viewer resolves relative hrefs.
export function renderInlineMarkdown(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function inlineMd(text, resolveHref) {
  return renderInlineMarkdown(text).replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, href) =>
    `<a href="${resolveHref(href)}" target="_blank" rel="noopener">${label}</a>`);
}

// Renders `md` and returns { html, toc } where toc is [{ level, text, id }] for
// every ## / ### heading (the "On this page" outline). Pass the doc's online URL
// so relative links resolve against it.
export function renderMarkdown(md, { onlineUrl } = {}) {
  const resolveHref = (href) => {
    if (!onlineUrl) return href;
    try { return new URL(href, onlineUrl).href; } catch { return href; }
  };

  const lines = md.split('\n');
  const toc = [];
  const seenSlugs = new Map();
  let html = '';
  let inUl = false, inOl = false, inTable = false, inQuote = false;

  const closeUl = () => { if (inUl) { html += '</ul>'; inUl = false; } };
  const closeOl = () => { if (inOl) { html += '</ol>'; inOl = false; } };
  const closeTable = () => { if (inTable) { html += '</tbody></table>'; inTable = false; } };
  const closeQuote = () => { if (inQuote) { html += '</blockquote>'; inQuote = false; } };
  const closeAll = () => { closeUl(); closeOl(); closeTable(); closeQuote(); };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);

    if (heading) {
      closeAll();
      const level = heading[1].length;
      const rendered = inlineMd(heading[2], resolveHref);
      const id = uniqueSlug(heading[2], seenSlugs);
      if (level > 1) toc.push({ level, text: heading[2], id });
      html += `<h${level} id="${id}" class="help-h${level}">${rendered}</h${level}>`;
    } else if (/^---+$/.test(line)) {
      closeAll();
      html += '<hr class="help-hr">';
    } else if (/^\s*\|/.test(line)) {
      closeUl(); closeOl(); closeQuote();
      if (/^[\s|:-]+$/.test(line)) {
        // table separator row (|---|---|) - nothing to emit
      } else {
        const cells = line.split('|').slice(1, -1).map((c) => c.trim());
        if (!inTable) {
          inTable = true;
          html += '<table class="help-table"><thead><tr>';
          cells.forEach((c) => { html += `<th>${inlineMd(c, resolveHref)}</th>`; });
          html += '</tr></thead><tbody>';
        } else {
          html += '<tr>';
          cells.forEach((c) => { html += `<td>${inlineMd(c, resolveHref)}</td>`; });
          html += '</tr>';
        }
      }
    } else if (/^\s*>\s?/.test(line)) {
      closeUl(); closeOl(); closeTable();
      if (!inQuote) { html += '<blockquote class="help-quote">'; inQuote = true; }
      html += `<p>${inlineMd(line.replace(/^\s*>\s?/, ''), resolveHref)}</p>`;
    } else if (/^\s*[-*]\s+/.test(line)) {
      closeOl(); closeTable(); closeQuote();
      if (!inUl) { html += '<ul class="help-ul">'; inUl = true; }
      html += `<li>${inlineMd(line.replace(/^\s*[-*]\s+/, ''), resolveHref)}</li>`;
    } else if (/^\s*\d+\.\s+/.test(line)) {
      closeUl(); closeTable(); closeQuote();
      if (!inOl) { html += '<ol class="help-ol">'; inOl = true; }
      html += `<li>${inlineMd(line.replace(/^\s*\d+\.\s+/, ''), resolveHref)}</li>`;
    } else if (line === '') {
      closeAll();
    } else {
      closeAll();
      html += `<p>${inlineMd(line, resolveHref)}</p>`;
    }
  }
  closeAll();
  return { html, toc };
}
