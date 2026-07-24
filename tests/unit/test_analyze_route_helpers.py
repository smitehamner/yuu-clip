"""web/routes/analyze.py pure helpers not already covered by
tests/integration/test_analyze.py's TestWhisperStep/TestComputeTimeEstimateMeasured
(both already unit-legal but out of this refactor's move scope - see the
refactor-for-quality plan's A-note on test_analyze.py). This file fills the
remaining gaps: _resolve_video_path (previously untested) and
_build_analyze_cmd's direct flag-assembly (previously only exercised
indirectly through the /api/analyze/start route)."""
from __future__ import annotations

import pytest
from fastapi import HTTPException

# ---------------------------------------------------------------------------
# _resolve_video_path
# ---------------------------------------------------------------------------

class TestResolveVideoPath:
    def _ctx(self, tmp_path):
        from yuu_clip.db.models import make_session

        class _Ctx:
            def get_db(self_inner):
                return make_session(tmp_path / "p.db")
        return _Ctx()

    def test_video_id_resolves_stored_path(self, tmp_path):
        from yuu_clip.db.models import Video, make_session
        from yuu_clip.web.routes.analyze import IngestRequest, _resolve_video_path

        session = make_session(tmp_path / "p.db")
        video = Video(path=str(tmp_path / "s.mkv"), filename="s.mkv", status="done")
        session.add(video)
        session.commit()
        video_id = video.id
        session.close()

        req = IngestRequest(video_id=video_id)
        assert _resolve_video_path(req, self._ctx(tmp_path)) == str(tmp_path / "s.mkv")

    def test_unknown_video_id_raises_404(self, tmp_path):
        from yuu_clip.web.routes.analyze import IngestRequest, _resolve_video_path

        req = IngestRequest(video_id=99999)
        with pytest.raises(HTTPException) as exc_info:
            _resolve_video_path(req, self._ctx(tmp_path))
        assert exc_info.value.status_code == 404

    def test_missing_path_and_video_id_raises_400(self, tmp_path):
        from yuu_clip.web.routes.analyze import IngestRequest, _resolve_video_path

        req = IngestRequest(path="")
        with pytest.raises(HTTPException) as exc_info:
            _resolve_video_path(req, self._ctx(tmp_path))
        assert exc_info.value.status_code == 400
        assert "video_id" in exc_info.value.detail

    def test_nonexistent_file_path_raises_400(self, tmp_path):
        from yuu_clip.web.routes.analyze import IngestRequest, _resolve_video_path

        req = IngestRequest(path=str(tmp_path / "gone.mkv"))
        with pytest.raises(HTTPException) as exc_info:
            _resolve_video_path(req, self._ctx(tmp_path))
        assert exc_info.value.status_code == 400
        assert "not found" in exc_info.value.detail.lower()

    def test_existing_file_path_returned_unchanged(self, tmp_path):
        from yuu_clip.web.routes.analyze import IngestRequest, _resolve_video_path

        video = tmp_path / "s.mkv"
        video.write_bytes(b"x")
        req = IngestRequest(path=str(video))
        assert _resolve_video_path(req, self._ctx(tmp_path)) == str(video)


# ---------------------------------------------------------------------------
# _build_analyze_cmd - flag assembly
# ---------------------------------------------------------------------------

class TestBuildAnalyzeCmdFlags:
    def _cmd(self, tmp_path, **overrides):
        from yuu_clip.web.routes.analyze import IngestRequest, _build_analyze_cmd
        req = IngestRequest(path="x.mkv", **overrides)
        return _build_analyze_cmd(req, "x.mkv", tmp_path)

    def test_force_flag_included_when_set(self, tmp_path):
        assert "--force" in self._cmd(tmp_path, force=True)

    def test_force_flag_omitted_by_default(self, tmp_path):
        assert "--force" not in self._cmd(tmp_path, force=False)

    def test_video_id_targeting_included(self, tmp_path):
        cmd = self._cmd(tmp_path, video_id=42)
        assert "--video-id" in cmd
        assert cmd[cmd.index("--video-id") + 1] == "42"

    def test_no_video_id_omits_targeting_flag(self, tmp_path):
        assert "--video-id" not in self._cmd(tmp_path)

    def test_subtitle_source_included_when_set(self, tmp_path):
        cmd = self._cmd(tmp_path, subtitle_source="stream:0")
        assert cmd[cmd.index("--subtitle-source") + 1] == "stream:0"

    def test_subtitle_source_omitted_when_unset(self, tmp_path):
        assert "--subtitle-source" not in self._cmd(tmp_path)

    def test_context_names_each_get_their_own_flag(self, tmp_path):
        cmd = self._cmd(tmp_path, context_names=["ctx_alpha", "ctx_beta"])
        assert cmd.count("--context") == 2
        assert "ctx_alpha" in cmd
        assert "ctx_beta" in cmd

    def test_diarize_true_adds_flag(self, tmp_path):
        cmd = self._cmd(tmp_path, diarize=True)
        assert "--diarize" in cmd
        assert "--no-diarize" not in cmd

    def test_diarize_false_adds_no_diarize_flag(self, tmp_path):
        cmd = self._cmd(tmp_path, diarize=False)
        assert "--no-diarize" in cmd
        assert "--diarize" not in cmd

    def test_diarize_none_omits_both_flags(self, tmp_path):
        cmd = self._cmd(tmp_path, diarize=None)
        assert "--diarize" not in cmd
        assert "--no-diarize" not in cmd

    def test_no_score_flag_included_when_set(self, tmp_path):
        assert "--no-score" in self._cmd(tmp_path, no_score=True)

    def test_profile_flag_included_when_set(self, tmp_path):
        cmd = self._cmd(tmp_path, profile="2track")
        assert cmd[cmd.index("--track-layout") + 1] == "2track"

    def test_segment_bounds_included_when_set(self, tmp_path):
        cmd = self._cmd(tmp_path, segment_start_s=10.0, segment_end_s=20.0)
        assert cmd[cmd.index("--segment-start") + 1] == "10.0"
        assert cmd[cmd.index("--segment-end") + 1] == "20.0"

    def test_always_ends_with_no_interact(self, tmp_path):
        assert self._cmd(tmp_path)[-1] == "--no-interact"

    def test_energy_and_scene_modes_always_included(self, tmp_path):
        cmd = self._cmd(tmp_path, energy_mode="full", scene_mode="transcript")
        assert cmd[cmd.index("--energy-mode") + 1] == "full"
        assert cmd[cmd.index("--scene-mode") + 1] == "transcript"
