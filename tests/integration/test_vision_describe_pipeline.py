"""pipeline/vision_describe.py - opt-in auto vision-LLM description (video-heavy
analysis Stage 4), exercised against a real seeded DB with a stubbed vision call."""
from __future__ import annotations


def _cfg(**overrides):
    from yuu_clip.config import Config
    cfg = Config()
    for key, value in overrides.items():
        setattr(cfg, key, value)
    return cfg


class TestAutoDescribeVisualClips:
    def _seed(self, tmp_path):
        from yuu_clip.db.models import ClipCandidate, Video, make_session

        session = make_session(tmp_path / "project.db")
        video = Video(
            path=str(tmp_path / "s.mkv"), filename="s.mkv",
            status="done", duration_ms=600_000,
        )
        session.add(video)
        session.flush()

        talk = ClipCandidate(
            video_id=video.id, start_ms=0, end_ms=10_000, status="pending",
            transcript_excerpt="Yuu: nice play", score_visual=0.95,
        )
        top1 = ClipCandidate(video_id=video.id, start_ms=20_000, end_ms=30_000, status="pending", score_visual=0.9)
        top2 = ClipCandidate(video_id=video.id, start_ms=40_000, end_ms=50_000, status="pending", score_visual=0.8)
        low = ClipCandidate(video_id=video.id, start_ms=60_000, end_ms=70_000, status="pending", score_visual=0.1)
        session.add_all([talk, top1, top2, low])
        session.commit()
        return session, video, {"talk": talk.id, "top1": top1.id, "top2": top2.id, "low": low.id}

    def _enabled_config(self, tmp_path, **overrides):
        vision_model = tmp_path / "vision.gguf"
        if not vision_model.exists():
            vision_model.write_bytes(b"x")
        mmproj = tmp_path / "mmproj.gguf"
        if not mmproj.exists():
            mmproj.write_bytes(b"x")
        defaults = {
            "llm_enabled": True, "vision_enabled": True, "llm_backend": "llamacpp",
            "llm_vision_model_path": str(vision_model), "llm_mmproj_path": str(mmproj),
            "visual_auto_vision_enabled": True, "visual_vision_topn": 2,
        }
        defaults.update(overrides)
        return _cfg(**defaults)

    def test_top_n_textless_clips_get_descriptions_others_do_not(self, tmp_path, monkeypatch):
        from yuu_clip.db.models import ClipCandidate
        from yuu_clip.pipeline.vision_describe import auto_describe_visual_clips

        session, video, ids = self._seed(tmp_path)
        config = self._enabled_config(tmp_path)  # topn=2

        calls = []

        def fake_describe(video_arg, clip, config_arg, proxy_dir, context_text=""):
            calls.append(clip.id)
            return f"On screen: clip {clip.id}"

        monkeypatch.setattr("yuu_clip.analyze.frames.analyze_clip_frames", fake_describe)

        described = auto_describe_visual_clips(video, config, session, proxy_dir=tmp_path)

        assert described == 2
        assert set(calls) == {ids["top1"], ids["top2"]}  # highest score_visual first, low + talk excluded

        top1 = session.get(ClipCandidate, ids["top1"])
        top2 = session.get(ClipCandidate, ids["top2"])
        low = session.get(ClipCandidate, ids["low"])
        talk = session.get(ClipCandidate, ids["talk"])

        assert top1.description == f"On screen: clip {ids['top1']}"
        assert top1.vision_analyzed_at is not None
        assert top2.description == f"On screen: clip {ids['top2']}"
        assert not low.description
        assert low.vision_analyzed_at is None
        assert not talk.description  # has a transcript - never eligible
        assert talk.vision_analyzed_at is None

    def test_disabled_makes_no_vision_calls(self, tmp_path, monkeypatch):
        from yuu_clip.pipeline.vision_describe import auto_describe_visual_clips

        session, video, _ids = self._seed(tmp_path)
        config = self._enabled_config(tmp_path, visual_auto_vision_enabled=False)

        calls = []
        monkeypatch.setattr(
            "yuu_clip.analyze.frames.analyze_clip_frames",
            lambda *a, **k: calls.append(1),
        )

        described = auto_describe_visual_clips(video, config, session, proxy_dir=tmp_path)

        assert described == 0
        assert calls == []

    def test_rerun_skips_already_described_clips(self, tmp_path, monkeypatch):
        from datetime import datetime, timezone

        from yuu_clip.db.models import ClipCandidate
        from yuu_clip.pipeline.vision_describe import auto_describe_visual_clips

        session, video, ids = self._seed(tmp_path)
        config = self._enabled_config(tmp_path, visual_vision_topn=8)

        top1 = session.get(ClipCandidate, ids["top1"])
        top1.vision_analyzed_at = datetime.now(timezone.utc)
        top1.description = "already described"
        session.commit()

        calls = []

        def fake_describe(video_arg, clip, config_arg, proxy_dir, context_text=""):
            calls.append(clip.id)
            return f"On screen: clip {clip.id}"

        monkeypatch.setattr("yuu_clip.analyze.frames.analyze_clip_frames", fake_describe)

        auto_describe_visual_clips(video, config, session, proxy_dir=tmp_path)

        assert ids["top1"] not in calls
        assert session.get(ClipCandidate, ids["top1"]).description == "already described"

    def test_per_clip_failure_does_not_abort_the_batch(self, tmp_path, monkeypatch):
        from yuu_clip.db.models import ClipCandidate
        from yuu_clip.pipeline.vision_describe import auto_describe_visual_clips

        session, video, ids = self._seed(tmp_path)
        config = self._enabled_config(tmp_path, visual_vision_topn=8)

        def flaky_describe(video_arg, clip, config_arg, proxy_dir, context_text=""):
            if clip.id == ids["top1"]:
                raise RuntimeError("vision backend unreachable")
            return f"On screen: clip {clip.id}"

        monkeypatch.setattr("yuu_clip.analyze.frames.analyze_clip_frames", flaky_describe)

        described = auto_describe_visual_clips(video, config, session, proxy_dir=tmp_path)

        assert described == 2  # top2 + low succeed; top1's failure is swallowed
        assert not session.get(ClipCandidate, ids["top1"]).description
        assert session.get(ClipCandidate, ids["top2"]).description
        assert session.get(ClipCandidate, ids["low"]).description
