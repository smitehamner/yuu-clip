import { escHtml } from './escapehtml.js';

// The transcription-language <option> list, shared by web Settings and the setup
// wizard: an "Auto-detect" default first, then every allowed language code rendered
// with its English display name (Intl.DisplayNames) and sorted by that name. Pure -
// it takes the code list and returns HTML; it never fetches the list or reads config
// (the caller supplies HTTP-backed or catalog-backed codes).
export function languageOptionsHtml(codes) {
  let nameOf = code => code;
  try {
    const displayNames = new Intl.DisplayNames(['en'], { type: 'language' });
    nameOf = code => {
      try { return displayNames.of(code) || code; } catch { return code; }
    };
  } catch { /* Intl.DisplayNames unavailable - fall back to raw codes */ }
  const named = (codes || [])
    .map(code => ({ code, name: nameOf(code) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return '<option value="">Auto-detect (recommended)</option>' +
    named.map(o => `<option value="${escHtml(o.code)}">${escHtml(o.name)}</option>`).join('');
}
