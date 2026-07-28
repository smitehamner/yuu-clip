// Pure math extracted from the clip export editor (static/library/exporteditor.js):
// the 9:16 crop-width fraction, the single-clip export-query builder, the trim-boundary
// offset/min-duration guard, and the quick/precise mode summary + tight-size-cap warning
// (moved here from the retired export modal). The PanelNav takeover, live preview, and
// transcript-click wiring stay in tests/ui/test_ui_exporteditor.py.

// _exportTightCapWarning reads a preset's cap through exportpresets.js's cache; stub the
// lookup so the tight-cap heuristic math is what's under test, not the cache.
let presetCapMb = null;
vi.mock('../../../yuu_clip/web/static/library/exportpresets.js', async (importActual) => {
  const actual = await importActual();
  return { ...actual, exportPresetTargetSizeMb: vi.fn(() => presetCapMb) };
});

import {
  cropWidthFraction, buildExportParams, computeTrimBoundary,
  _exportModeSummary, _exportTightCapWarning,
  trimBarSpan, trimBarPercent, formatOffsetDelta,
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

  it('sends the container only when no preset is set (a preset dictates its own)', () => {
    expect(params({ container: 'mp4' }).get('container')).toBe('mp4');
    expect(params({ container: 'mp4', preset: 'tiktok' }).get('container')).toBe(null);
    expect(params({ container: '' }).get('container')).toBe(null);
  });

  it('carries the retranscribe model and speaker-labels flag only when retranscribing', () => {
    const on = params({ retranscribe: true, retxModel: 'small', speakerLabels: true });
    expect(on.get('retranscribe')).toBe('true');
    expect(on.get('retranscribe_model')).toBe('small');
    expect(on.get('speaker_labels')).toBe('true');
    const speakersOff = params({ retranscribe: true, retxModel: 'small', speakerLabels: false });
    expect(speakersOff.get('speaker_labels')).toBe('false');
    const off = params({ retranscribe: false, retxModel: 'small' });
    expect(off.get('retranscribe')).toBe(null);
    expect(off.get('retranscribe_model')).toBe(null);
  });
});

describe('_exportModeSummary', () => {
  it('is a Quick (stream-copy) export when nothing forces a re-encode', () => {
    const s = _exportModeSummary(false, false, false);
    expect(s.precise).toBe(false);
    expect(s.text).toContain('Quick export');
    expect(s.text).toContain('~1 s off');
  });

  it('is Precise and names burned-in captions as the re-encode reason', () => {
    const s = _exportModeSummary(true, false, false);
    expect(s.precise).toBe(true);
    expect(s.text).toBe('Precise export - re-encodes for burned-in captions (slower).');
  });

  it('joins both re-encode reasons when captions and a title card are on', () => {
    expect(_exportModeSummary(true, true, false).text).toContain('burned-in captions and the title card');
  });

  it('appends the retranscribe note to either mode', () => {
    expect(_exportModeSummary(false, false, true).text).toContain('Retranscribing runs first and adds time.');
    expect(_exportModeSummary(true, false, true).text).toContain('Retranscribing runs first and adds time.');
  });
});

describe('_exportTightCapWarning', () => {
  const clip = (over = {}) => ({ start_ms: 0, end_ms: 240_000, kind: 'clip', ...over });

  afterEach(() => { presetCapMb = null; });

  it('warns when a long clip is squeezed under a small size cap', () => {
    presetCapMb = 10;  // 10 MB over 4 min = ~341 kbps, under the 900 floor
    expect(_exportTightCapWarning('discord-10mb', clip())).toBe(
      'This 4-minute clip squeezed under a 10 MB cap will look rough (blocky). Consider a larger preset or a shorter selection.',
    );
  });

  it('says "scene" for a scene-kind selection', () => {
    presetCapMb = 10;
    expect(_exportTightCapWarning('discord-10mb', clip({ kind: 'scene' }))).toContain('4-minute scene');
  });

  it('is silent when the per-second budget clears the floor', () => {
    presetCapMb = 10;  // 10 MB over 30 s = ~2730 kbps, above the floor
    expect(_exportTightCapWarning('discord-10mb', clip({ end_ms: 30_000 }))).toBe('');
  });

  it('is silent for a preset with no size cap', () => {
    presetCapMb = null;
    expect(_exportTightCapWarning('', clip())).toBe('');
  });

  it('is silent when the clip is missing or has no timing', () => {
    presetCapMb = 10;
    expect(_exportTightCapWarning('discord-10mb', null)).toBe('');
    expect(_exportTightCapWarning('discord-10mb', { start_ms: null, end_ms: null })).toBe('');
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

describe('trimBarSpan', () => {
  it('is the clip window padded on both sides when nothing has been nudged', () => {
    // clip [10s, 20s], effective == saved, 30s padding.
    expect(trimBarSpan(10_000, 20_000, 10_000, 20_000, 30_000)).toEqual({
      startMs: 0,  // clamped at 0 (10s - 30s would be negative)
      endMs: 50_000,
    });
  });

  it('widens past the padding when a boundary has been nudged further out', () => {
    // Start pulled back to 45s before the clip - past the 30s pad.
    expect(trimBarSpan(60_000, 70_000, 15_000, 70_000, 30_000)).toEqual({
      startMs: 15_000, endMs: 100_000,
    });
  });

  it('never goes negative even with a small clip start and large padding', () => {
    expect(trimBarSpan(2_000, 5_000, 2_000, 5_000, 30_000).startMs).toBe(0);
  });
});

describe('trimBarPercent', () => {
  it('maps the span start/end to 0/100', () => {
    expect(trimBarPercent(0, 0, 50_000)).toBe(0);
    expect(trimBarPercent(50_000, 0, 50_000)).toBe(100);
  });

  it('maps a midpoint to 50', () => {
    expect(trimBarPercent(25_000, 0, 50_000)).toBe(50);
  });

  it('does not divide by zero for a degenerate zero-width span', () => {
    expect(Number.isFinite(trimBarPercent(0, 10_000, 10_000))).toBe(true);
  });
});

describe('formatOffsetDelta', () => {
  it('reads "at the detected mark" for a negligible offset', () => {
    expect(formatOffsetDelta(0)).toBe('at the detected mark');
    expect(formatOffsetDelta(0.03)).toBe('at the detected mark');
  });

  it('reads earlier for a negative offset, later for a positive one', () => {
    expect(formatOffsetDelta(-1.5)).toBe('1.5s earlier than detected');
    expect(formatOffsetDelta(2)).toBe('2s later than detected');
  });

  it('drops a trailing .0', () => {
    expect(formatOffsetDelta(-3)).toBe('3s earlier than detected');
  });
});
