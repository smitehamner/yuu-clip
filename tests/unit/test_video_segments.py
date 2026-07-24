"""Unit tests for pure split/segment helpers in web/routes/videos.py (no DB)."""
from yuu_clip.web.routes.videos import segment_index_for

# 3 segments: [0,10) -> 0, [10,20) -> 1, [20,30) -> 2
BOUNDARIES = [0.0, 10.0, 20.0, 30.0]


class TestSegmentIndexFor:
    def test_start_of_first_segment(self):
        assert segment_index_for(0.0, BOUNDARIES) == 0

    def test_within_first_segment(self):
        assert segment_index_for(5.0, BOUNDARIES) == 0

    def test_lower_boundary_belongs_to_upper_segment(self):
        # Half-open: a time exactly on an interior boundary owns the segment it opens.
        assert segment_index_for(10.0, BOUNDARIES) == 1
        assert segment_index_for(20.0, BOUNDARIES) == 2

    def test_within_middle_segment(self):
        assert segment_index_for(15.0, BOUNDARIES) == 1

    def test_just_below_last_boundary(self):
        assert segment_index_for(29.999, BOUNDARIES) == 2

    def test_exactly_on_final_boundary_clamps_to_last(self):
        # 30.0 is not < 30.0, so it falls through to the clamp.
        assert segment_index_for(30.0, BOUNDARIES) == 2

    def test_past_last_boundary_clamps_to_last(self):
        assert segment_index_for(100.0, BOUNDARIES) == 2

    def test_single_segment_always_index_zero(self):
        assert segment_index_for(0.0, [0.0, 50.0]) == 0
        assert segment_index_for(25.0, [0.0, 50.0]) == 0
        assert segment_index_for(50.0, [0.0, 50.0]) == 0
