"""
Clips-vs-Scenes Stage 3: the LLM transcript-segmentation generator.

Covers the geometry the generator owns - boundary clamping to the transcript range and
the min/max scene bounds, dropping out-of-order/overlapping/too-short boundaries, the
count cap, transcript chunking, and the kind='scene' + tags row shape. The LLM call
itself is mocked, so this runs offline.
"""
from __future__ import annotations

import json
import unittest.mock as mock

from yuu_clip.config import Config
from yuu_clip.scoring.llm import request_scene_boundaries
from yuu_clip.segments import scene_segmenter as ss


class _Seg:
    def __init__(self, start_ms, end_ms, text="hello there"):
        self.start_ms = start_ms
        self.end_ms = end_ms
        self.text = text


def _cfg(**overrides):
    cfg = Config()
    cfg.scene_min_ms = 60_000
    cfg.scene_max_ms = 300_000
    cfg.scene_target_count = 20
    for k, v in overrides.items():
        setattr(cfg, k, v)
    return cfg


# ---------------------------------------------------------------------------
# Boundary normalization - the core robustness against bad LLM output
# ---------------------------------------------------------------------------

class TestNormalizeBoundaries:
    def _norm(self, proposals, start=0, end=600_000, min_ms=60_000, max_ms=300_000):
        return ss._normalize_boundaries(proposals, start, end, min_ms, max_ms)

    def test_valid_boundary_kept(self):
        out = self._norm([{"start_ms": 0, "end_ms": 120_000, "reason": "arc"}])
        assert out == [(0, 120_000, "arc")]

    def test_out_of_order_sorted(self):
        out = self._norm([
            {"start_ms": 300_000, "end_ms": 400_000, "reason": "b"},
            {"start_ms": 0, "end_ms": 100_000, "reason": "a"},
        ])
        assert [b[0] for b in out] == [0, 300_000]

    def test_overlapping_later_dropped(self):
        out = self._norm([
            {"start_ms": 0, "end_ms": 200_000, "reason": "a"},
            {"start_ms": 100_000, "end_ms": 250_000, "reason": "overlaps"},
        ])
        assert out == [(0, 200_000, "a")]

    def test_too_short_dropped(self):
        out = self._norm([{"start_ms": 0, "end_ms": 30_000, "reason": "short"}])
        assert out == []

    def test_too_long_clamped_to_max(self):
        out = self._norm([{"start_ms": 0, "end_ms": 500_000, "reason": "long"}])
        assert out == [(0, 300_000, "long")]

    def test_clamped_to_timeline_range(self):
        out = self._norm(
            [{"start_ms": -5_000, "end_ms": 999_000, "reason": "wild"}],
            start=10_000, end=200_000,
        )
        assert out == [(10_000, 200_000, "wild")]

    def test_end_before_start_dropped(self):
        out = self._norm([{"start_ms": 200_000, "end_ms": 100_000, "reason": "inverted"}])
        assert out == []


# ---------------------------------------------------------------------------
# Chunking + transcript formatting
# ---------------------------------------------------------------------------

class TestChunking:
    def test_single_chunk_under_budget(self):
        segs = [_Seg(0, 1000, "a" * 100), _Seg(1000, 2000, "b" * 100)]
        chunks = ss._chunk_segments(segs, char_budget=8_000)
        assert len(chunks) == 1

    def test_splits_when_over_budget(self):
        segs = [_Seg(i * 1000, i * 1000 + 500, "x" * 400) for i in range(10)]
        chunks = ss._chunk_segments(segs, char_budget=1_000)
        assert len(chunks) > 1
        # Every segment lands in exactly one chunk.
        assert sum(len(c) for c in chunks) == len(segs)

    def test_transcript_block_prefixes_start_ms(self):
        block = ss._format_transcript_block([_Seg(1500, 3000, "hi"), _Seg(3000, 4000, "yo")])
        assert block == "[1500] hi\n[3000] yo"

    def test_blank_segments_skipped_in_block(self):
        block = ss._format_transcript_block([_Seg(0, 1000, "   "), _Seg(1000, 2000, "real")])
        assert block == "[1000] real"


# ---------------------------------------------------------------------------
# generate_scenes end-to-end (LLM mocked)
# ---------------------------------------------------------------------------

_BOUNDS_PAYLOAD = json.dumps([
    {"start_ms": 0, "end_ms": 120_000, "reason": "opening arc"},
    {"start_ms": 120_000, "end_ms": 240_000, "reason": "the payoff"},
])


class TestRequestSceneBoundaries:
    def _call(self, *responses):
        with mock.patch("yuu_clip.scoring.llm._call_client", side_effect=list(responses)):
            return request_scene_boundaries("[0] hi\n[1000] bye", _cfg())

    def test_plain_json_parsed(self):
        out = self._call(_BOUNDS_PAYLOAD)
        assert out == [
            {"start_ms": 0, "end_ms": 120_000, "reason": "opening arc"},
            {"start_ms": 120_000, "end_ms": 240_000, "reason": "the payoff"},
        ]

    def test_fenced_json_parsed(self):
        out = self._call(f"```json\n{_BOUNDS_PAYLOAD}\n```")
        assert len(out) == 2

    def test_prefixed_prose_triggers_repair_then_succeeds(self):
        out = self._call("Sure, here you go: not json {{{", _BOUNDS_PAYLOAD)
        assert len(out) == 2

    def test_malformed_twice_raises(self):
        import pytest
        with pytest.raises(json.JSONDecodeError):
            self._call("nope {{{", "still nope")

    def test_non_list_response_raises(self):
        import pytest
        with pytest.raises(ValueError):
            self._call(json.dumps({"start_ms": 0, "end_ms": 1000}))

    def test_items_missing_keys_skipped(self):
        payload = json.dumps([
            {"start_ms": 0, "end_ms": 120_000, "reason": "ok"},
            {"reason": "no times"},
            {"start_ms": "x", "end_ms": "y", "reason": "unparseable"},
        ])
        out = self._call(payload)
        assert out == [{"start_ms": 0, "end_ms": 120_000, "reason": "ok"}]


class TestGenerateScenes:
    def _run(self, proposals, cfg=None, segs=None, monkeypatch_target=None):
        cfg = cfg or _cfg()
        segs = segs if segs is not None else [_Seg(0, 600_000, "long conversation")]
        video = mock.MagicMock()
        video.id = 7
        session = mock.MagicMock()
        added: list = []
        session.add.side_effect = added.append

        with mock.patch.object(ss, "merge_transcribable_segments", return_value=segs), \
             mock.patch.object(ss, "request_scene_boundaries", return_value=proposals), \
             mock.patch.object(ss, "build_excerpt_for_window", return_value="excerpt text"):
            scenes = ss.generate_scenes(video, [mock.MagicMock()], cfg, session)
        return scenes, added

    def test_creates_scene_rows_with_kind_and_tags(self):
        scenes, added = self._run([{"start_ms": 0, "end_ms": 120_000, "reason": "an arc"}])
        assert len(scenes) == 1
        scene = scenes[0]
        assert scene.kind == "scene"
        assert scene.video_id == 7
        assert scene.tags == ["scene", "llm_segmented"]
        assert scene.reasons == ["an arc"]
        assert scene.transcript_excerpt == "excerpt text"
        assert scene.status == "pending"
        assert added == scenes

    def test_no_segments_returns_empty_without_llm_call(self):
        cfg = _cfg()
        video = mock.MagicMock()
        session = mock.MagicMock()
        with mock.patch.object(ss, "merge_transcribable_segments", return_value=[]), \
             mock.patch.object(ss, "request_scene_boundaries") as req:
            scenes = ss.generate_scenes(video, [], cfg, session)
        assert scenes == []
        req.assert_not_called()

    def test_count_cap_applied(self):
        proposals = [
            {"start_ms": i * 120_000, "end_ms": i * 120_000 + 90_000, "reason": f"s{i}"}
            for i in range(10)
        ]
        # A wide timeline so all ten proposals are individually valid.
        segs = [_Seg(0, 1_200_000, "text")]
        scenes, _ = self._run(proposals, cfg=_cfg(scene_target_count=3), segs=segs)
        assert len(scenes) == 3

    def test_invalid_proposals_produce_no_scenes(self):
        scenes, _ = self._run([{"start_ms": 0, "end_ms": 10_000, "reason": "too short"}])
        assert scenes == []

    def test_chunk_failure_skipped_not_fatal(self):
        # request_scene_boundaries raising on a chunk must not abort generation.
        cfg = _cfg()
        segs = [_Seg(0, 600_000, "conversation")]
        video = mock.MagicMock()
        video.id = 1
        session = mock.MagicMock()
        with mock.patch.object(ss, "merge_transcribable_segments", return_value=segs), \
             mock.patch.object(ss, "request_scene_boundaries", side_effect=RuntimeError("bad json")), \
             mock.patch.object(ss, "build_excerpt_for_window", return_value="x"):
            scenes = ss.generate_scenes(video, [mock.MagicMock()], cfg, session)
        assert scenes == []
