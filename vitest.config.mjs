import { defineConfig } from 'vitest/config';

// Browser-less unit layer for the web UI's pure module logic (formatters, escaping,
// score math, filter/sort, parse helpers). The heavier flows that need a real browser
// (navigation, SSE, focus traps, live getComputedStyle) stay in the Playwright suite
// under tests/ui/. Run via `yuu-dev test-js`.
export default defineConfig({
  test: {
    include: ['tests/js/**/*.test.js'],
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['tests/js/setup.js'],
  },
});
