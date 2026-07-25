// Pure logic extracted out of analyze.js's DOM-writing renderers/handlers (STRUCT-3).
import {
  _reanalyzeWarningHtml, _fmtBytesHuman, parseImportDoneLine, parseImportProgressLine,
  _segmentChainAbortMessage, _trackRowDefaults,
} from '../../../yuu_clip/web/static/analyze/analyze.js';

describe('_reanalyzeWarningHtml', () => {
  it('names the file and omits the exported-clips note when nothing was exported', () => {
    const html = _reanalyzeWarningHtml({filename: 'session.mp4', exported: 0});
    expect(html).toContain('session.mp4');
    expect(html).not.toContain('exported clip');
  });

  it('pluralizes the exported-clips note', () => {
    expect(_reanalyzeWarningHtml({filename: 'a.mp4', exported: 1})).toContain('1 exported clip ');
    expect(_reanalyzeWarningHtml({filename: 'a.mp4', exported: 3})).toContain('3 exported clips');
  });
});

describe('_fmtBytesHuman', () => {
  it('is "unknown" for a missing or non-positive size', () => {
    expect(_fmtBytesHuman(0)).toBe('unknown');
    expect(_fmtBytesHuman(null)).toBe('unknown');
    expect(_fmtBytesHuman(-5)).toBe('unknown');
  });

  it('formats bytes as a whole number', () => {
    expect(_fmtBytesHuman(500)).toBe('500 B');
  });

  it('formats larger sizes with one decimal at the right unit', () => {
    expect(_fmtBytesHuman(1536)).toBe('1.5 KB');
    expect(_fmtBytesHuman(5 * 1024 * 1024)).toBe('5.0 MB');
  });

  it('caps at GB rather than continuing to TB', () => {
    expect(_fmtBytesHuman(2 * 1024 * 1024 * 1024)).toBe('2.0 GB');
  });
});

describe('parseImportDoneLine', () => {
  it('extracts and trims the imported path', () => {
    expect(parseImportDoneLine('[Imported] D:\\videos\\a.mp4  ')).toBe('D:\\videos\\a.mp4');
  });

  it('is null for a non-matching line', () => {
    expect(parseImportDoneLine('[Download] 50% of a.mp4')).toBeNull();
  });
});

describe('parseImportProgressLine', () => {
  it('parses percent only', () => {
    expect(parseImportProgressLine('[Download] 42.5% of video.mp4')).toEqual({
      pct: 42.5, speedPart: '', etaPart: '',
    });
  });

  it('parses percent, speed, and ETA together', () => {
    expect(parseImportProgressLine('[Download] 10% of video.mp4 at 2.3MiB/s, ETA 00:30')).toEqual({
      pct: 10, speedPart: ' at 2.3MiB/s', etaPart: ' (~00:30 left)',
    });
  });

  it('is null for a non-matching line', () => {
    expect(parseImportProgressLine('[Imported] video.mp4')).toBeNull();
  });
});

describe('_segmentChainAbortMessage', () => {
  it('names a single remaining segment in the singular', () => {
    expect(_segmentChainAbortMessage(3, 2)).toContain('segment 3 of 3');
  });

  it('names a range when more than one segment remains', () => {
    expect(_segmentChainAbortMessage(5, 1)).toContain('segments 2-5 of 5');
  });

  it('names the whole run when the first segment fails', () => {
    expect(_segmentChainAbortMessage(4, 0)).toContain('segments 1-4 of 4');
  });
});

describe('_trackRowDefaults', () => {
  it('defaults track 0 to combined and later tracks to unlabeled, both toggles on', () => {
    expect(_trackRowDefaults(0, null)).toEqual({label: 'combined', doTranscribe: true, doScore: true});
    expect(_trackRowDefaults(1, null)).toEqual({label: 'unlabeled', doTranscribe: true, doScore: true});
  });

  it('a saved game_sounds assignment with no explicit toggles still defaults to true', () => {
    // The `label !== 'game_sounds'` half of the original ternary is only reachable
    // when there's no existing assignment, and in that branch label is always
    // 'combined'/'unlabeled' (never 'game_sounds') - so this case falls through to
    // the "existing assignment, not explicitly false" default instead. The actual
    // game_sounds auto-uncheck happens later, via onLabelChange on select change.
    expect(_trackRowDefaults(2, {label: 'game_sounds'})).toEqual({
      label: 'game_sounds', doTranscribe: true, doScore: true,
    });
  });

  it('reuses a saved assignment verbatim, including explicit false toggles', () => {
    expect(_trackRowDefaults(0, {label: 'player_voice', do_transcribe: false, do_score: true})).toEqual({
      label: 'player_voice', doTranscribe: false, doScore: true,
    });
  });

  it('a saved assignment with toggles omitted defaults them to true', () => {
    expect(_trackRowDefaults(0, {label: 'player_voice'})).toEqual({
      label: 'player_voice', doTranscribe: true, doScore: true,
    });
  });
});
