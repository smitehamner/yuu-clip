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
    expect(values).toEqual(['default', 'blue']);
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
