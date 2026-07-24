// Pure math extracted from the clip export editor (static/library/exporteditor.js):
// the 9:16 crop-width fraction, the single-clip export-query builder, and the
// trim-boundary offset/min-duration guard. The PanelNav takeover, live preview,
// and transcript-click wiring stay in tests/ui/test_ui_exporteditor.py.
import {
  cropWidthFraction, buildExportParams, computeTrimBoundary,
} from '../../../yuu_clip/web/static/library/exporteditor.js';

describe('cropWidthFraction', () => {
  it('is a fraction of frame width for a landscape source', () => {
    // 16:9 -> (9/16) / (16/9) = 0.31640625
    expect(cropWidthFraction(16 / 9)).toBeCloseTo(0.31640625, 6);
  });

  it('is exactly the full width for a 9:16 source (nothing to pan)', () => {
    expect(cropWidthFraction(9 / 16)).toBe(1);
  });

  it('clamps to 1 for a source already narrower than 9:16', () => {
    expect(cropWidthFraction(0.4)).toBe(1);
  });
});

describe('buildExportParams', () => {
  const params = (over) => buildExportParams({
    captionMode: 'none', preset: '', titleCard: false, config: {}, ...over,
  });

  it('sets burn_subs and the caption-style fields only for burn-in', () => {
    const p = params({
      captionMode: 'burn',
      config: { caption_font_name: 'Inter', caption_font_size: 30, caption_position: 'top' },
    });
    expect(p.get('burn_subs')).toBe('true');
    expect(p.get('embed_subs')).toBe(null);
    expect(p.get('caption_font')).toBe('Inter');
    expect(p.get('caption_size')).toBe('30');
    expect(p.get('caption_position')).toBe('top');
  });

  it('sets embed_subs and no caption-style fields for embed', () => {
    const p = params({ captionMode: 'embed', config: { caption_font_size: 30 } });
    expect(p.get('embed_subs')).toBe('true');
    expect(p.get('burn_subs')).toBe(null);
    expect(p.get('caption_size')).toBe(null);
  });

  it('omits caption params entirely for none', () => {
    const p = params({ captionMode: 'none' });
    expect(p.toString()).toBe('');
  });

  it('carries preset and title_card when set', () => {
    const p = params({ preset: 'tiktok', titleCard: true });
    expect(p.get('preset')).toBe('tiktok');
    expect(p.get('title_card')).toBe('true');
  });

  it('defaults missing burn-in caption-style fields', () => {
    const p = params({ captionMode: 'burn', config: {} });
    expect(p.get('caption_font')).toBe('');
    expect(p.get('caption_size')).toBe('0');
    expect(p.get('caption_position')).toBe('bottom');
  });
});

describe('computeTrimBoundary', () => {
  // A clip whose saved window is [10s, 20s] with no offsets yet applied.
  const ctx = (over = {}) => ({
    clipStartMs: 10_000, clipEndMs: 20_000,
    effStartMs: 10_000, effEndMs: 20_000, minDurationMs: 1_000, ...over,
  });

  it('accepts a start move and returns the offset from the saved start', () => {
    expect(computeTrimBoundary('start', 12_000, ctx())).toEqual({ ok: true, offset: 2 });
  });

  it('accepts an end move and returns a negative offset from the saved end', () => {
    expect(computeTrimBoundary('end', 18_000, ctx())).toEqual({ ok: true, offset: -2 });
  });

  it('clamps a start before 0 and measures the offset from there', () => {
    expect(computeTrimBoundary('start', -500, ctx())).toEqual({ ok: true, offset: -10 });
  });

  it('rejects a start that would leave under the 1s minimum', () => {
    expect(computeTrimBoundary('start', 19_500, ctx())).toEqual({ ok: false });
  });

  it('rejects an end that would leave under the 1s minimum', () => {
    expect(computeTrimBoundary('end', 10_500, ctx())).toEqual({ ok: false });
  });

  it('floors the duration against the current effective opposite edge, not the saved one', () => {
    // End was already pulled in to 15s; a start at 14.5s now leaves only 0.5s.
    expect(computeTrimBoundary('start', 14_500, ctx({ effEndMs: 15_000 }))).toEqual({ ok: false });
  });

  it('rounds the offset to 3 decimals', () => {
    expect(computeTrimBoundary('start', 11_234.6, ctx()).offset).toBe(1.235);
  });
});
