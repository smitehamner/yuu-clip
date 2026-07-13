"""Video-heavy analysis Stage 2: visual candidate generation across the 4 modes.

Drives the ingest dispatch (_generate_candidates) on one seeded recording - a dense
talk region plus a silent high-motion span - and asserts each visual_candidate_mode
yields the expected candidate set. The talk-heavy candidate must be present and
byte-identical across every mode (the "don't drown the core" guarantee).
"""
from __future__ import annotations

from yuu_clip.config import Config
from yuu_clip.db.models import (
    AudioTrack,
    Transcript,
    TranscriptSegment,
    Video,
    VisualActivity,
    make_session,
)
from yuu_clip.pipeline.ingest import _generate_candidates


def _seed(tmp_path):
    session = make_session(tmp_path / "test.db")
    v = Video(path=str(tmp_path / "v.mkv"), filename="v.mkv", status="done", duration_ms=600_000)
    session.add(v)
    session.flush()

    track = AudioTrack(
        video_id=v.id, stream_index=0, label="combined",
        do_transcribe=True, do_score=True, relevance_weight=1.0,
    )
    session.add(track)
    session.flush()

    tx = Transcript(audio_track_id=track.id, model_name="base")
    session.add(tx)
    session.flush()

    # Dense talk region: 0 - 40 s, contiguous, plenty of words -> one talk candidate.
    for i in range(8):
        session.add(TranscriptSegment(
            transcript_id=tx.id, start_ms=i * 5_000, end_ms=(i + 1) * 5_000,
            text="this is a normal spoken line with several words",
        ))
    # Sparse "runaway" line over a silent high-motion span: 100 - 160 s. Below the
    # speech-density floor, so the transcript path drops it (except in relax).
    session.add(TranscriptSegment(
        transcript_id=tx.id, start_ms=100_000, end_ms=160_000, text="ok",
    ))
    # On-screen motion under the sparse span.
    for ms in range(100_000, 160_000, 500):
        session.add(VisualActivity(video_id=v.id, timecode_ms=ms, intensity=40.0))
    session.flush()
    return session, v, tx


def _run(session, v, tx, mode):
    config = Config()
    config.visual_candidate_mode = mode
    return _generate_candidates(
        v, [tx], config, session,
        no_segment=False, no_transcribe=False, force=True,
    )


def _talk_candidate(cands):
    return next(c for c in cands if c.start_ms == 0)


def test_off_yields_only_the_talk_candidate(tmp_path):
    session, v, tx = _seed(tmp_path)
    try:
        cands = _run(session, v, tx, "off")
        assert len(cands) == 1
        talk = _talk_candidate(cands)
        assert talk.end_ms == 40_000
        assert "no_speech" not in talk.tags and "visual" not in talk.tags
    finally:
        session.close()


def test_relax_rescues_the_low_speech_motion_window(tmp_path):
    session, v, tx = _seed(tmp_path)
    try:
        cands = _run(session, v, tx, "relax")
        assert len(cands) == 2
        rescued = next(c for c in cands if c.start_ms == 100_000)
        assert "visual" in rescued.tags
        assert "no_speech" not in rescued.tags  # it still has (sparse) speech
        assert rescued.transcript_excerpt == "ok"
    finally:
        session.close()


def test_gaps_adds_a_textless_visual_candidate(tmp_path):
    session, v, tx = _seed(tmp_path)
    try:
        cands = _run(session, v, tx, "gaps")
        assert len(cands) == 2
        visual = next(c for c in cands if c.start_ms == 100_000)
        assert set(visual.tags) == {"visual", "no_speech"}
        assert (visual.transcript_excerpt or "") == ""
    finally:
        session.close()


def test_parallel_adds_a_textless_visual_candidate(tmp_path):
    session, v, tx = _seed(tmp_path)
    try:
        cands = _run(session, v, tx, "parallel")
        assert len(cands) >= 2
        assert any(set(c.tags) == {"visual", "no_speech"} for c in cands)
    finally:
        session.close()


def test_talk_candidate_unchanged_across_all_modes(tmp_path):
    starts_ends = {}
    for mode in ("off", "relax", "gaps", "parallel"):
        mode_dir = tmp_path / mode
        mode_dir.mkdir()
        session, v, tx = _seed(mode_dir)
        try:
            cands = _run(session, v, tx, mode)
            talk = _talk_candidate(cands)
            starts_ends[mode] = (talk.start_ms, talk.end_ms, talk.transcript_excerpt)
        finally:
            session.close()
    assert len(set(starts_ends.values())) == 1  # identical in every mode


def test_visual_candidates_persist_to_db(tmp_path):
    from yuu_clip.db.models import ClipCandidate
    session, v, tx = _seed(tmp_path)
    try:
        _run(session, v, tx, "gaps")
        session.commit()
        no_speech = session.query(ClipCandidate).filter_by(video_id=v.id).all()
        assert any("no_speech" in c.tags for c in no_speech)
    finally:
        session.close()
