// renderDetail transcript-card states (static/clips/clips.js). Ported from
// tests/ui/test_ui_transcript.py::TestTextlessVisualClipTranscriptCard: renderDetail
// builds #detail as pure HTML, so happy-dom drives it directly. Its two async
// follow-ups (loadClipTranscript for a talk clip, the /api/tags suggestion load)
// are stubbed so no real fetch escapes the test. A textless "visual" clip gets an
// explicit no-dialogue state; a talk clip keeps its transcript.
vi.mock('../../../yuu_clip/web/static/analyze/transcript.js', async (importActual) => ({
  ...(await importActual()),
  loadClipTranscript: vi.fn(),
}));

import { renderDetail } from '../../../yuu_clip/web/static/clips/clips.js';

beforeEach(() => {
  globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ tags: [] }) }));
});

function clip(id, overrides = {}) {
  return {
    id, start_hms: '0:00', duration_hms: '0:05', status: 'pending',
    tags: [], user_tags: [], start_offset: 0, end_offset: 0,
    has_export: false, exports: [], transcript_excerpt: '',
    scored_at: '2026-07-13T00:00:00+00:00',
    score_overall: 0.5, score_funny: 0.0, score_dramatic: 0.0,
    score_action: 0.0, score_visual: 0.8, score_laugh: null,
    ...overrides,
  };
}

const card = () => document.querySelector("[data-collapse-key='clip-transcript']");

afterEach(() => { delete window._visionEnabled; });

describe('renderDetail - transcript card', () => {
  it('a textless visual clip shows the no-dialogue state with its visual score', () => {
    renderDetail(clip(9601, { tags: ['visual', 'no_speech'] }));
    expect(card().textContent).toContain('No dialogue in this clip');
    expect(card().querySelector("span[title='How visually active this clip is']").textContent).toContain('80%');
    const noDialogueTags = [...card().querySelectorAll('.tag')].filter((t) => t.textContent.includes('No dialogue'));
    expect(noDialogueTags).toHaveLength(1);
  });

  it('shows the vision summary as a one-liner when vision is enabled', () => {
    window._visionEnabled = true;
    renderDetail(clip(9602, { tags: ['visual', 'no_speech'], vision_summary: 'A player clutches a 1v3 round.' }));
    expect(card().textContent).toContain('A player clutches a 1v3 round.');
  });

  it('a talk clip keeps its transcript and never shows the no-dialogue state', () => {
    renderDetail(clip(9603, { transcript_excerpt: 'Yuu: we pulled off the heist', score_visual: 0.9 }));
    expect(card().textContent).toContain('we pulled off the heist');
    expect(card().textContent).not.toContain('No dialogue in this clip');
  });
});
