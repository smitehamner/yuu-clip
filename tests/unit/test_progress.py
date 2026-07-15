"""Round-trip + malformed-line behavior for the structured progress channel."""
from yuu_clip.pipeline.progress import (
    Stage,
    emit_progress,
    format_progress,
    parse_progress,
)


class TestFormatParseRoundTrip:
    def test_stage_only(self):
        parsed = parse_progress(format_progress(Stage.EXTRACT))
        assert parsed == {"stage": "extract"}

    def test_done_total(self):
        parsed = parse_progress(format_progress(Stage.SCORE, done=3, total=12))
        assert parsed == {"stage": "score", "done": 3, "total": 12}

    def test_label(self):
        parsed = parse_progress(format_progress(Stage.FRAMES_SAMPLE, done=2, total=8, label="frame 2"))
        assert parsed == {"stage": "frames_sample", "done": 2, "total": 8, "label": "frame 2"}

    def test_string_stage_accepted(self):
        assert parse_progress(format_progress("transcribe")) == {"stage": "transcribe"}

    def test_absent_fields_omitted_from_line(self):
        line = format_progress(Stage.ENERGY)
        assert "done" not in line and "total" not in line and "label" not in line


class TestParseRejectsNonMarkers:
    def test_plain_log_line_returns_none(self):
        assert parse_progress("  Scoring 3/12...") is None

    def test_missing_prefix_returns_none(self):
        assert parse_progress('{"stage": "extract"}') is None

    def test_malformed_json_returns_none(self):
        assert parse_progress("@@PROGRESS {not json") is None

    def test_non_object_payload_returns_none(self):
        assert parse_progress("@@PROGRESS [1, 2, 3]") is None

    def test_unknown_stage_returns_none(self):
        assert parse_progress('@@PROGRESS {"stage": "bogus"}') is None

    def test_missing_stage_returns_none(self):
        assert parse_progress('@@PROGRESS {"done": 1, "total": 2}') is None


def test_emit_progress_prints_marker_line(capsys):
    emit_progress(Stage.TRANSCRIBE, done=1, total=2)
    out = capsys.readouterr().out.strip()
    assert parse_progress(out) == {"stage": "transcribe", "done": 1, "total": 2}
