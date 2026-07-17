// Transport-agnostic HTML escaper, shared by the web app and the Electron setup
// wizard (each imports it through its own esbuild bundle - see ARCHITECTURE landmine
// #2's boundary rule: shared modules take data, never fetch or IPC). Escapes & < > "
// so a value is safe both as text and inside a double-quoted attribute.
export function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
