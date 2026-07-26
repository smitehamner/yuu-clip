"""yuu_clip/cli/reel.py clip-selection helpers (_select_reel_clips / _gather_demo_clips).

These back the `yuuclip reel` command's --video / --status / --min-score / --top /
--clip-id filters. The web route (routes/reel.py) queues this command as a subprocess
rather than calling these helpers in-process, so this is the only place their filtering
and ordering logic is exercised directly.
"""
from __future__ import annotations

import pytest

from yuu_clip.cli.reel import _gather_demo_clips, _select_reel_clips
from yuu_clip.db.models import ClipCandidate, Video, make_session


@pytest.fixture()
def session(tmp_path):
    db = make_session(tmp_path / "project.db")
    try:
        video_a = Video(path="a.mkv", filename="a.mkv", status="done", duration_ms=600_000)
        video_b = Video(path="b.mkv", filename="b.mkv", status="done", duration_ms=600_000)
        db.add_all([video_a, video_b])
        db.flush()

        clips = [
            ClipCandidate(video_id=video_a.id, start_ms=0, end_ms=10_000, score_overall=0.9, status="approved"),
            ClipCandidate(video_id=video_a.id, start_ms=20_000, end_ms=30_000, score_overall=0.5, status="approved"),
            ClipCandidate(video_id=video_a.id, start_ms=40_000, end_ms=50_000, score_overall=0.2, status="rejected"),
            ClipCandidate(video_id=video_b.id, start_ms=0, end_ms=10_000, score_overall=0.8, status="approved"),
            ClipCandidate(video_id=video_b.id, start_ms=20_000, end_ms=30_000, score_overall=0.3, status="pending"),
        ]
        db.add_all(clips)
        db.commit()
        db.video_a_id = video_a.id
        db.video_b_id = video_b.id
        yield db
    finally:
        db.close()


class TestGatherDemoClips:
    def test_no_filters_returns_all_ordered_by_video_then_score_desc(self, session):
        clips = _gather_demo_clips(session, [], None, 0.0, None)
        assert [round(c.score_overall, 2) for c in clips if c.video_id == session.video_a_id] == [0.9, 0.5, 0.2]
        assert [round(c.score_overall, 2) for c in clips if c.video_id == session.video_b_id] == [0.8, 0.3]

    def test_video_ids_filter_restricts_to_named_videos(self, session):
        clips = _gather_demo_clips(session, [session.video_b_id], None, 0.0, None)
        assert all(c.video_id == session.video_b_id for c in clips)
        assert len(clips) == 2

    def test_status_filter_keeps_only_matching_status(self, session):
        clips = _gather_demo_clips(session, [], "approved", 0.0, None)
        assert all(c.status == "approved" for c in clips)
        assert len(clips) == 3

    def test_min_score_excludes_lower_scored_clips(self, session):
        clips = _gather_demo_clips(session, [], None, 0.6, None)
        assert all(c.score_overall >= 0.6 for c in clips)
        assert len(clips) == 2

    def test_min_score_zero_is_not_applied_as_a_filter(self, session):
        # min_score > 0 gates the query; 0.0 means "no threshold" (default), so a
        # clip scored exactly 0.0 would still be included if one existed.
        clips = _gather_demo_clips(session, [], None, 0.0, None)
        assert len(clips) == 5

    def test_top_n_keeps_highest_scored_per_video_reordered_by_start_time(self, session):
        clips = _gather_demo_clips(session, [], None, 0.0, top=1)
        assert len(clips) == 2
        by_video = {c.video_id: c for c in clips}
        assert round(by_video[session.video_a_id].score_overall, 2) == 0.9
        assert round(by_video[session.video_b_id].score_overall, 2) == 0.8
        # Result stays ordered by (video_id, start_ms), not by score.
        assert clips == sorted(clips, key=lambda c: (c.video_id, c.start_ms))

    def test_combining_status_and_min_score_filters(self, session):
        clips = _gather_demo_clips(session, [], "approved", 0.6, None)
        assert [round(c.score_overall, 2) for c in clips] == [0.9, 0.8]


class TestSelectReelClips:
    def test_explicit_clip_ids_preserve_requested_order(self, session):
        all_clips = session.query(ClipCandidate).order_by(ClipCandidate.id).all()
        low, high = all_clips[2].id, all_clips[0].id
        result = _select_reel_clips(session, [low, high], [], None, None, 0.0, None)
        assert [c.id for c in result] == [low, high]

    def test_explicit_clip_ids_skip_unknown_ids(self, session):
        real_id = session.query(ClipCandidate).first().id
        result = _select_reel_clips(session, [999_999, real_id], [], None, None, 0.0, None)
        assert [c.id for c in result] == [real_id]

    def test_explicit_clip_ids_unknown_id_is_logged_and_printed(self, session, caplog):
        real_id = session.query(ClipCandidate).first().id
        with caplog.at_level("WARNING", logger="yuu_clip.cli.reel"):
            _select_reel_clips(session, [999_999, real_id], [], None, None, 0.0, None)
        assert any("999999" in message for message in caplog.messages)

        from yuu_clip.cli._base import console
        with console.capture() as capture:
            _select_reel_clips(session, [999_999, real_id], [], None, None, 0.0, None)
        assert "999999" in capture.get()

    def test_no_clip_ids_falls_back_to_gather_with_filters(self, session):
        result = _select_reel_clips(session, [], [], None, "approved", 0.0, None)
        assert all(c.status == "approved" for c in result)

    def test_bare_video_id_option_is_merged_into_video_ids(self, session):
        result = _select_reel_clips(session, [], [], session.video_b_id, None, 0.0, None)
        assert all(c.video_id == session.video_b_id for c in result)

    def test_video_id_not_duplicated_when_also_in_video_ids(self, session):
        result = _select_reel_clips(
            session, [], [session.video_b_id], session.video_b_id, None, 0.0, None
        )
        assert all(c.video_id == session.video_b_id for c in result)
