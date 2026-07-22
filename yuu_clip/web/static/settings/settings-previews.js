// Feature-map - Settings > Export live previews (filename template + title card).
//   API: routes/config.py · Tests: tests/ui/test_ui_settings.py
// ── export section (filename template preview) ───────────────────────────────
// Sample values for the export-filename-template live preview - a plausible
// clip, not real data. Mirrors export_naming.export_base_stem's placeholder
// set and sanitization so the preview matches what the server would produce.
const _EXPORT_PREVIEW_SAMPLE = {
  video: 'MyRecording', clip_id: 42, start: '15-30', end: '16-00', score: '0.8',
  date: new Date().toISOString().slice(0, 10), preset: 'youtube-1080p',
};

function _updateExportNameTemplatePreview() {
  const el = document.getElementById('export-name-template-preview');
  if (!el) return;
  const template = document.getElementById('s-export-name-template').value
    || '{video}_clip{clip_id}_{start}';
  let rendered;
  try {
    rendered = template.replace(/\{(\w*)\}/g, (m, key) => {
      if (!(key in _EXPORT_PREVIEW_SAMPLE)) throw new Error('unknown placeholder');
      return _EXPORT_PREVIEW_SAMPLE[key];
    });
  } catch (e) {
    el.textContent = 'Preview: (unknown placeholder in template)';
    return;
  }
  rendered = rendered.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
  el.textContent = `Preview: ${rendered || '(empty - falls back to the default template)'}.mkv`;
}

// ── title card preview + contrast warning (Settings -> Export) ────────────────
// A pure-CSS/HTML mock, not an ffmpeg render - "approximate" is called out in
// the UI copy. Colors here are the user's own chosen values (like the
// score-gradient exception in utils.js), not UI chrome, so they're applied
// directly rather than through a theme token.
// Sample values for the title-card template live preview - mirrors the
// placeholder set and per-line truncation of reel.title_card_lines so the mock
// matches what ffmpeg would render.
const _TITLE_CARD_PREVIEW_SAMPLE = {
  description: 'Chaos erupts as the squad clutches a 1v4.',
  start: '2:15',
  duration: '0:22',
};
const _TITLE_CARD_DESC_MAX = 90;
const _TITLE_CARD_CONTRAST_WARN_THRESHOLD = 3;

function _renderTitleCardPreviewLines(template) {
  const unknown = [];
  const lines = [];
  for (const rawLine of template.split('\n')) {
    let rendered = rawLine.replace(/\{(\w*)\}/g, (match, key) => {
      if (!(key in _TITLE_CARD_PREVIEW_SAMPLE)) { unknown.push(key); return match; }
      return _TITLE_CARD_PREVIEW_SAMPLE[key];
    }).trim();
    if (rendered.length > _TITLE_CARD_DESC_MAX) {
      rendered = rendered.slice(0, _TITLE_CARD_DESC_MAX - 1).trimEnd() + '…';
    }
    if (rendered) lines.push(rendered);
  }
  return {lines, unknown};
}

function _hexLuminance(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return null;
  const [r, g, b] = [0, 2, 4]
    .map(i => parseInt(m[1].slice(i, i + 2), 16) / 255)
    .map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function _contrastRatio(hex1, hex2) {
  const l1 = _hexLuminance(hex1);
  const l2 = _hexLuminance(hex2);
  if (l1 === null || l2 === null) return null;
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function _updateTitleCardPreview() {
  const bg = document.getElementById('s-title-card-bg-color')?.value || '#000000';
  const fg = document.getElementById('s-title-card-font-color')?.value || '#ffffff';
  const scale = parseFloat(document.getElementById('s-title-card-scale')?.value || '1') || 1;
  const template = document.getElementById('s-title-card-template')?.value ?? '';

  const box = document.getElementById('s-title-card-preview');
  if (box) {
    box.style.background = bg;
    box.textContent = '';
    const {lines, unknown} = _renderTitleCardPreviewLines(template);
    const shown = lines.length
      ? lines
      : [`${_TITLE_CARD_PREVIEW_SAMPLE.start}  ·  ${_TITLE_CARD_PREVIEW_SAMPLE.duration}`];
    shown.forEach((text, idx) => {
      const line = document.createElement('div');
      line.textContent = text;
      line.style.color = fg;
      line.style.overflowWrap = 'anywhere';
      if (idx === 0) {
        line.style.fontWeight = '600';
        line.style.fontSize = `${Math.round(15 * scale)}px`;
      } else {
        line.style.fontSize = `${Math.round(11 * scale)}px`;
        line.style.marginTop = '6px';
      }
      box.appendChild(line);
    });
    const placeholderWarn = document.getElementById('s-title-card-template-warning');
    if (placeholderWarn) {
      const bad = [...new Set(unknown)];
      placeholderWarn.style.display = bad.length ? '' : 'none';
      placeholderWarn.textContent = bad.length
        ? `⚠ Unknown placeholder: ${bad.map(u => `{${u}}`).join(', ')}`
        : '';
    }
  }

  const warningEl = document.getElementById('s-title-card-contrast-warning');
  if (warningEl) {
    const ratio = _contrastRatio(bg, fg);
    warningEl.style.display = (ratio !== null && ratio < _TITLE_CARD_CONTRAST_WARN_THRESHOLD) ? '' : 'none';
  }
}

// ── static index.html handlers this module owns (wired once at load) ──────────
// The export-name and title-card fields are fixed, never-recreated elements in
// index.html's settings panel, so a single load-time listener can't double-fire
// on a re-render. The colour inputs are driven by the shared colorpicker, which
// dispatches a bubbling 'input' event on commit (colorpicker.js).
function _wireStaticHandlers() {
  document.getElementById('s-export-name-template')
    .addEventListener('input', () => _updateExportNameTemplatePreview());
  for (const id of ['s-title-card-bg-color', 's-title-card-font-color',
    's-title-card-scale', 's-title-card-template']) {
    document.getElementById(id)
      .addEventListener('input', () => _updateTitleCardPreview());
  }
}

export function initSettingsPreviewsListeners() {
  _wireStaticHandlers();
}

export { _updateExportNameTemplatePreview, _updateTitleCardPreview };
