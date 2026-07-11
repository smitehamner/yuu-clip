"""
Clips-vs-Scenes Stage 3: the opt-in LLM scene generator, pipeline-wired.

Covers the analyze-side integration: generating + scoring kind='scene' rows leaves
the recording's clips intact, the LLM-backend pre-flight skips cleanly (never fails
after a long run), the Settings toggle round-trips through /api/config, and the CLI
command carries --scenes only when generation is enabled. The LLM itself is mocked.
"""
from __future__ import annotations

import unittest.mock as mock

from yuu_clip.db.models import (
    ClipCandidate,
    Transcript,
    TranscriptSegment,
    Video,
    make_session,
)
from yuu_clip.pipeline.ingest import _generate_and_score_scenes


def _db(project_dir):
    return make_session(project_dir / ".yuu-clip" / "project.db")


def _seed_transcript(session, video):
    """Attach a transcript with segments spanning the video to its transcribable track."""
    track = next(t for t in video.audio_tracks if t.do_transcribe)
    tr = Transcript(audio_track_id=track.id, model_name="test")
    session.add(tr)
    session.flush()
    for i in range(10):
        session.add(TranscriptSegment(
            transcript_id=tr.id, start_ms=i * 60_000, end_ms=(i + 1) * 60_000,
            text=f"line {i} with some spoken words here",
        ))
    session.commit()
    return tr


_BOUNDARIES = [
    {"start_ms": 0, "end_ms": 120_000, "reason": "opening arc"},
    {"start_ms": 180_000, "end_ms": 360_000, "reason": "the payoff"},
]


class TestGenerateAndScoreScenes:
    def _run(self, project_dir, boundaries=None):
        session = _db(project_dir)
        video = session.query(Video).first()
        transcripts = [_seed_transcript(session, video)]
        from yuu_clip.config import Config
        cfg = Config()
        with mock.patch("yuu_clip.scoring.llm.check_llm_available", return_value=(True, "")), \
             mock.patch("yuu_clip.segments.scene_segmenter.request_scene_boundaries",
                        return_value=boundaries if boundaries is not None else _BOUNDARIES), \
             mock.patch("yuu_clip.scoring.llm.LLMScorer.is_available", return_value=False):
            _generate_and_score_scenes(video, transcripts, cfg, session)
        session.commit()
        rows = session.query(ClipCandidate).filter_by(video_id=video.id).all()
        by_kind = {"clip": [], "scene": []}
        for r in rows:
            by_kind[r.kind].append(r)
        session.close()
        return by_kind

    def test_creates_scene_rows(self, project_dir):
        by_kind = self._run(project_dir)
        assert len(by_kind["scene"]) == 2
        assert all("scene" in s.tags and "llm_segmented" in s.tags for s in by_kind["scene"])
        assert all(s.scored_at is not None for s in by_kind["scene"])

    def test_clips_left_intact(self, project_dir):
        by_kind = self._run(project_dir)
        assert len(by_kind["clip"]) == 3  # the three seeded clips survive

    def test_rerun_replaces_scenes_not_clips(self, project_dir):
        self._run(project_dir)
        by_kind = self._run(project_dir, boundaries=[_BOUNDARIES[0]])
        assert len(by_kind["scene"]) == 1  # replaced, not appended
        assert len(by_kind["clip"]) == 3


class TestPreflightSkip:
    def test_backend_off_skips_generation_no_rows(self, project_dir):
        session = _db(project_dir)
        video = session.query(Video).first()
        transcripts = [_seed_transcript(session, video)]
        from yuu_clip.config import Config
        cfg = Config()
        with mock.patch("yuu_clip.scoring.llm.check_llm_available",
                        return_value=(False, "No model file path set")), \
             mock.patch("yuu_clip.segments.scene_segmenter.request_scene_boundaries") as req:
            _generate_and_score_scenes(video, transcripts, cfg, session)
        req.assert_not_called()
        scenes = session.query(ClipCandidate).filter_by(video_id=video.id, kind="scene").all()
        assert scenes == []
        session.close()

    def test_llm_disabled_skips_generation(self, project_dir):
        session = _db(project_dir)
        video = session.query(Video).first()
        transcripts = [_seed_transcript(session, video)]
        from yuu_clip.config import Config
        cfg = Config()
        cfg.llm_enabled = False
        with mock.patch("yuu_clip.segments.scene_segmenter.request_scene_boundaries") as req:
            _generate_and_score_scenes(video, transcripts, cfg, session)
        req.assert_not_called()
        assert session.query(ClipCandidate).filter_by(video_id=video.id, kind="scene").count() == 0
        session.close()


class TestConfigToggleRoundTrip:
    def test_defaults_off(self, client):
        assert client.get("/api/config").json()["scene_generation_enabled"] is False

    def test_patch_persists(self, client):
        r = client.patch("/api/config", json={"scene_generation_enabled": True})
        assert r.status_code == 200
        assert client.get("/api/config").json()["scene_generation_enabled"] is True


class TestBuildAnalyzeCmdScenesFlag:
    def _cmd(self, generate_scenes):
        from yuu_clip.web.routes.analyze import IngestRequest, _build_analyze_cmd
        req = IngestRequest(path="C:/x/session.mkv", model="base")
        from pathlib import Path
        return _build_analyze_cmd(req, req.path, Path("C:/proj"), generate_scenes=generate_scenes)

    def test_scenes_flag_present_when_enabled(self):
        assert "--scenes" in self._cmd(True)

    def test_scenes_flag_absent_when_disabled(self):
        assert "--scenes" not in self._cmd(False)
