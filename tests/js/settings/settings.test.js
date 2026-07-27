// Theme + accent switching in static/settings/settings.js - pure DOM + localStorage,
// so ported from the non-getComputedStyle cases in tests/ui/test_ui_theme.py. The
// contrast (getComputedStyle), before-first-paint reload, and settings-save-gating
// cases need a real browser and stay in Playwright.
import { applyTheme, applyAccent } from '../../../yuu_clip/web/static/settings/settings.js';

const root = () => document.documentElement;

describe('theme switcher', () => {
  it('the Settings select lists every theme', () => {
    const values = [...document.querySelectorAll('#s-theme option')].map((o) => o.value);
    expect(values).toEqual(['dark', 'light', 'high-contrast']);
  });
  it('applying a non-dark theme sets the attribute and persists it', () => {
    applyTheme('light');
    expect(root().dataset.theme).toBe('light');
    expect(localStorage.getItem('yuuclip-theme')).toBe('light');
  });
  it('applying dark removes the attribute (dark is the default, attribute-less)', () => {
    applyTheme('light');
    applyTheme('dark');
    expect(root().dataset.theme).toBeUndefined();
    expect(localStorage.getItem('yuuclip-theme')).toBe('dark');
  });
});

describe('accent switcher', () => {
  it('the Settings select lists every accent', () => {
    const values = [...document.querySelectorAll('#s-accent option')].map((o) => o.value);
    expect(values).toEqual(['default', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink']);
  });
  it('applying a non-default accent sets the attribute and persists it', () => {
    applyAccent('blue');
    expect(root().dataset.accent).toBe('blue');
    expect(localStorage.getItem('yuuclip-accent')).toBe('blue');
  });
  it('applying default removes the attribute', () => {
    applyAccent('blue');
    applyAccent('default');
    expect(root().dataset.accent).toBeUndefined();
    expect(localStorage.getItem('yuuclip-accent')).toBe('default');
  });
});

describe('settings rail drift guard', () => {
  // Every settings section must have a matching left-rail nav link, or the section
  // is reachable only by scrolling (how Hot-words + Sensitive Content went missing -
  // UX review R1). Pure static markup, so ported from the getComputedStyle-free
  // case in tests/ui/test_ui_settings.py::TestSettingsPanelChrome.
  it('every settings section has a rail nav link and vice versa', () => {
    const sectionIds = [...document.querySelectorAll('.settings-inner .settings-section')]
      .map((el) => el.id);
    // Scoped to the left-rail nav only - inline cross-links between related controls
    // (e.g. the LLM GPU note -> Hardware) deliberately reuse the .settings-jump-link
    // class/attribute for the same click delegation (see settings.js _wireJumpNav),
    // so they aren't part of this section<->nav invariant.
    const linkedIds = [...document.querySelectorAll('.settings-rail .settings-nav-link')]
      .map((el) => el.dataset.section);
    expect(sectionIds.length).toBeGreaterThan(0);
    expect(new Set(sectionIds)).toEqual(new Set(linkedIds));
  });
});
