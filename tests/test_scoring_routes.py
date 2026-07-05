"""yuu_clip/web/routes/scoring.py — route guards and pure helpers.

(_ms_to_hms is covered in test_utils.py.)
"""
from __future__ import annotations

import pytest

# ---------------------------------------------------------------------------
# _collect_transcript_segments
# ---------------------------------------------------------------------------

class TestCollectTranscriptSegments:
    def _make_db(self, tmp_path, do_transcribe=True):
        from yuu_clip.db.models import AudioTrack, Transcript, Video, make_session
        session = make_session(tmp_path / "test.db")
        v = Video(path=str(tmp_path / "v.mkv"), filename="v.mkv", status="done", duration_ms=60_000)
        session.add(v)
        session.flush()
        track = AudioTrack(
            video_id=v.id, stream_index=0, label="combined",
            do_transcribe=do_transcribe, do_score=True, relevance_weight=1.0,
        )
        session.add(track)
        session.flush()
        tx = Transcript(audio_track_id=track.id, model_name="base")
        session.add(tx)
        session.flush()
        return session, v, tx

    def test_no_tracks_returns_empty(self, tmp_path):
        from yuu_clip.db.models import Video, make_session
        from yuu_clip.web.routes.scoring import _collect_transcript_segments
        session = make_session(tmp_path / "empty.db")
        v = Video(path=str(tmp_path / "v.mkv"), filename="v.mkv", status="done", duration_ms=60_000)
        session.add(v)
        session.flush()
        try:
            result = _collect_transcript_segments(session, v.id)
        finally:
            session.close()
        assert result == []

    def test_non_transcribed_track_excluded(self, tmp_path):
        from yuu_clip.web.routes.scoring import _collect_transcript_segments
        session, v, tx = self._make_db(tmp_path, do_transcribe=False)
        from yuu_clip.db.models import TranscriptSegment
        session.add(TranscriptSegment(transcript_id=tx.id, start_ms=0, end_ms=5_000, text="hello"))
        session.flush()
        try:
            result = _collect_transcript_segments(session, v.id)
        finally:
            session.close()
        assert result == []

    def test_segments_returned_sorted_by_start_ms(self, tmp_path):
        from yuu_clip.db.models import TranscriptSegment
        from yuu_clip.web.routes.scoring import _collect_transcript_segments
        session, v, tx = self._make_db(tmp_path)
        session.add(TranscriptSegment(transcript_id=tx.id, start_ms=10_000, end_ms=15_000, text="second"))
        session.add(TranscriptSegment(transcript_id=tx.id, start_ms=0, end_ms=5_000, text="first"))
        session.flush()
        try:
            result = _collect_transcript_segments(session, v.id)
        finally:
            session.close()
        assert len(result) == 2
        assert result[0].start_ms == 0
        assert result[1].start_ms == 10_000


# ---------------------------------------------------------------------------
# regenerate_summary guards
# ---------------------------------------------------------------------------

class TestRegenerateSummaryGuards:
    def test_regenerate_404_for_missing_video(self, client):
        r = client.get("/api/videos/99999/regenerate-summary")
        assert r.status_code == 404

    def test_regenerate_400_when_no_transcript(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        r = client.get(f"/api/videos/{vid_id}/regenerate-summary")
        assert r.status_code == 400
        assert "transcript" in r.json()["detail"].lower()


# ---------------------------------------------------------------------------
# redescribe_clips LLM-unavailable guard
# ---------------------------------------------------------------------------

class TestRedescribeClipsGuard:
    def test_redescribe_503_when_llm_disabled(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        r = client.get(f"/api/videos/{vid_id}/redescribe-clips")
        # Default config has ollama_enabled=True but no real backend — check_llm_available
        # returns False → 503
        assert r.status_code == 503

    def test_redescribe_404_for_missing_video(self, client):
        r = client.get("/api/videos/99999/redescribe-clips")
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# needs_model empty state (Stage 02) — summary/timeline without a language model
# ---------------------------------------------------------------------------

def _seed_transcript(project_dir):
    """Attach a transcript segment to the seeded video's track so summary/timeline
    get past their 'no transcript' guard and reach the LLM-availability check."""
    from yuu_clip.db.models import AudioTrack, Transcript, TranscriptSegment, make_session
    session = make_session(project_dir / ".yuu-clip" / "project.db")
    try:
        track = session.query(AudioTrack).first()
        tx = Transcript(audio_track_id=track.id, model_name="base")
        session.add(tx)
        session.flush()
        session.add(TranscriptSegment(
            transcript_id=tx.id, start_ms=0, end_ms=5_000, text="we pulled off the heist",
        ))
        session.commit()
    finally:
        session.close()


class TestNeedsModelEmptyState:
    def test_summarize_returns_needs_model_when_llm_unavailable(self, project_dir, client):
        _seed_transcript(project_dir)
        vid_id = client.get("/api/videos").json()[0]["id"]
        r = client.post(f"/api/videos/{vid_id}/summarize")
        assert r.status_code == 200
        body = r.json()
        assert body["needs_model"] is True
        assert body["show_cta"] is True
        assert body["heading"]

    def test_timeline_streams_needs_model_when_llm_unavailable(self, project_dir, client):
        _seed_transcript(project_dir)
        vid_id = client.get("/api/videos").json()[0]["id"]
        r = client.get(f"/api/videos/{vid_id}/timeline")
        assert r.status_code == 200
        assert '"needs_model": true' in r.text
        assert "__DONE__" in r.text

    def test_regenerate_summary_streams_needs_model_when_llm_unavailable(self, project_dir, client):
        _seed_transcript(project_dir)
        vid_id = client.get("/api/videos").json()[0]["id"]
        r = client.get(f"/api/videos/{vid_id}/regenerate-summary")
        assert r.status_code == 200
        assert '"needs_model": true' in r.text


# ---------------------------------------------------------------------------
# rescore_clip 404 guard
# ---------------------------------------------------------------------------

class TestRescoreClipGuard:
    def test_rescore_clip_404_for_missing_clip(self, client):
        r = client.get("/api/clips/99999/rescore")
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# _config_with_context_weights
# ---------------------------------------------------------------------------

class TestConfigWithContextWeights:
    def _cfg(self):
        from yuu_clip.config import Config
        return Config()

    def test_no_overrides_returns_same_config(self):
        from yuu_clip.web.routes.scoring import _config_with_context_weights
        cfg = self._cfg()
        result = _config_with_context_weights(cfg, {}, [])
        assert result is cfg

    def test_weight_override_applied(self):
        from yuu_clip.web.routes.scoring import _config_with_context_weights
        cfg = self._cfg()
        contexts = {"ctx-a": {"score_funny_weight": 3.0}}
        result = _config_with_context_weights(cfg, contexts, ["ctx-a"])
        assert result.score_funny_weight == pytest.approx(3.0)

    def test_none_weight_not_applied(self):
        from yuu_clip.web.routes.scoring import _config_with_context_weights
        cfg = self._cfg()
        original_funny = cfg.score_funny_weight
        contexts = {"ctx-a": {"score_funny_weight": None}}
        result = _config_with_context_weights(cfg, contexts, ["ctx-a"])
        assert result.score_funny_weight == pytest.approx(original_funny)
