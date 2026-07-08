from __future__ import annotations

import json
from types import SimpleNamespace

from yuu_clip.pipeline.ingest import AnalyzeOptions
from yuu_clip.pipeline.run_meta import StageRecorder, _run_settings, build_run_json


def _cfg(**over):
    base = dict(
        whisper_model="base",
        scene_detection_mode="fast",
        scorer_energy_weight=1.0,
        scorer_scene_weight=0.5,
        scorer_llm_weight=2.0,
        scorer_laugh_weight=1.5,
        diarization_backend="null",
    )
    base.update(over)
    return SimpleNamespace(**base)


class TestStageRecorder:
    def test_records_named_stages_in_order(self):
        rec = StageRecorder()
        with rec.stage("Extract audio"):
            pass
        with rec.stage("Transcribe"):
            pass
        assert [s["name"] for s in rec.stages] == ["Extract audio", "Transcribe"]
        assert all(isinstance(s["seconds"], float) for s in rec.stages)

    def test_records_stage_even_when_body_raises(self):
        rec = StageRecorder()
        try:
            with rec.stage("Score"):
                raise RuntimeError("boom")
        except RuntimeError:
            pass
        assert rec.stages[0]["name"] == "Score"

    def test_elapsed_ms_non_negative(self):
        assert StageRecorder().elapsed_ms >= 0


class TestRunSettings:
    def test_external_captions_source(self):
        opts = AnalyzeOptions(subtitle_source="stream:2")
        s = _run_settings(_cfg(), opts, transcribed=False, diarized=False)
        assert s["captions_source"] == "external"

    def test_subtitle_source_recorded_for_re_analyze_default(self):
        opts = AnalyzeOptions(subtitle_source=r"C:\clips\session.srt")
        s = _run_settings(_cfg(), opts, transcribed=False, diarized=False)
        assert s["subtitle_source"] == r"C:\clips\session.srt"

    def test_subtitle_source_is_null_when_transcribed(self):
        s = _run_settings(_cfg(), AnalyzeOptions(), transcribed=True, diarized=False)
        assert s["subtitle_source"] is None

    def test_whisper_captions_source_and_speaker_flag(self):
        s = _run_settings(_cfg(), AnalyzeOptions(), transcribed=True, diarized=True)
        assert s["captions_source"] == "whisper"
        assert s["speaker_labels"] is True

    def test_no_captions_when_not_transcribed(self):
        s = _run_settings(_cfg(), AnalyzeOptions(no_transcribe=True), transcribed=False, diarized=False)
        assert s["captions_source"] == "none"

    def test_weights_and_track_layout_default(self):
        s = _run_settings(_cfg(), AnalyzeOptions(), transcribed=True, diarized=False)
        assert s["track_layout"] == "default"
        assert s["weights"]["llm"] == 2.0


class TestBuildRunJson:
    def test_returns_valid_json_with_expected_shape(self):
        from datetime import datetime, timezone
        rec = StageRecorder()
        with rec.stage("Extract audio"):
            pass
        # transcribed/diarized False avoids importing ctranslate2 / torch here.
        raw = build_run_json(
            rec, _cfg(), AnalyzeOptions(no_transcribe=True),
            datetime.now(timezone.utc), transcribed=False, diarized=False,
        )
        data = json.loads(raw)
        assert set(data) >= {"started_at", "finished_at", "elapsed_ms", "device", "settings", "stages"}
        assert data["device"]["has_gpu"] is False
        assert "transcribe" not in data["device"]  # stage did not run → not reported
        assert data["stages"][0]["name"] == "Extract audio"


class TestSerializerExposesRunMetadata:
    def test_video_detail_includes_analyze_run(self, client, project_dir):
        from yuu_clip.db.models import Video, make_session

        session = make_session(project_dir / ".yuu-clip" / "project.db")
        video = session.query(Video).first()
        video.analyze_run_json = json.dumps({"elapsed_ms": 1234, "device": {"has_gpu": True}, "stages": []})
        session.commit()
        vid_id = video.id
        session.close()

        data = client.get(f"/api/videos/{vid_id}").json()
        assert data["analyze_run"]["elapsed_ms"] == 1234
        assert data["analyze_run"]["device"]["has_gpu"] is True

    def test_analyze_run_null_when_unset(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        assert client.get(f"/api/videos/{vid_id}").json()["analyze_run"] is None
