"""Pure Python helpers and DB model properties.

Not to be confused with test_ui_utils.py, which exercises the JS helpers in
yuu_clip/web/static/*.js via Playwright.
"""
from __future__ import annotations

# ---------------------------------------------------------------------------
# _ms_to_hms
# ---------------------------------------------------------------------------

class TestMsToHms:
    """_ms_to_hms converts milliseconds to h:mm:ss or m:ss."""

    def _convert(self, ms):
        from yuu_clip.web.routes.scoring import _ms_to_hms
        return _ms_to_hms(ms)

    def test_seconds_only(self):
        assert self._convert(30_000) == "0:30"

    def test_minutes_and_seconds(self):
        assert self._convert(90_000) == "1:30"

    def test_exactly_one_hour(self):
        assert self._convert(3_600_000) == "1:00:00"

    def test_hours_minutes_seconds(self):
        assert self._convert(3_661_000) == "1:01:01"

    def test_zero_ms(self):
        assert self._convert(0) == "0:00"

    def test_one_minute_boundary(self):
        assert self._convert(60_000) == "1:00"


# ---------------------------------------------------------------------------
# format_context_block
# ---------------------------------------------------------------------------

class TestFormatContextBlock:
    """format_context_block builds the LLM injection text for named contexts."""

    def _fmt(self, contexts, context_ids):
        from yuu_clip.contexts import format_context_block
        return format_context_block(contexts, context_ids)

    def test_empty_context_ids_returns_empty_string(self):
        contexts = {"una": {"display_name": "Una", "setting": "A world"}}
        assert self._fmt(contexts, []) == ""

    def test_unknown_context_id_skipped(self):
        assert self._fmt({}, ["nonexistent"]) == ""

    def test_single_context_contains_header_and_footer(self):
        contexts = {"una": {"display_name": "Una Server", "setting": "A fantasy world"}}
        result = self._fmt(contexts, ["una"])
        assert "== WORLD CONTEXT: Una Server ==" in result
        assert "== END CONTEXT ==" in result

    def test_setting_field_included(self):
        contexts = {"una": {"display_name": "Una", "setting": "Dragons everywhere"}}
        result = self._fmt(contexts, ["una"])
        assert "Dragons everywhere" in result

    def test_empty_field_omitted(self):
        contexts = {
            "una": {
                "display_name": "Una",
                "setting": "A world",
                "your_characters": "",
                "other_characters": "",
                "notes": "",
            }
        }
        result = self._fmt(contexts, ["una"])
        assert "Your characters" not in result

    def test_multiple_contexts_joined(self):
        contexts = {
            "ctx1": {"display_name": "C1", "setting": "Setting one"},
            "ctx2": {"display_name": "C2", "setting": "Setting two"},
        }
        result = self._fmt(contexts, ["ctx1", "ctx2"])
        assert "C1" in result
        assert "C2" in result
        assert "Setting one" in result
        assert "Setting two" in result

    def test_context_id_order_preserved(self):
        contexts = {
            "a": {"display_name": "Alpha", "setting": "First"},
            "b": {"display_name": "Beta", "setting": "Second"},
        }
        result = self._fmt(contexts, ["b", "a"])
        assert result.index("Beta") < result.index("Alpha")


class TestFormatCharacterBlock:
    """format_character_block builds the per-clip 'characters speaking' scoring text."""

    def _fmt(self, characters):
        from yuu_clip.contexts import format_character_block
        return format_character_block(characters)

    def test_empty_list_returns_empty_string(self):
        assert self._fmt([]) == ""

    def test_boosted_character_includes_numeric_value_and_scale(self):
        result = self._fmt([{"name": "Alara", "lore": "A rogue elf.", "score_boost": 0.3}])
        assert "Alara" in result
        assert "A rogue elf." in result
        assert "[boost 0.30]" in result
        assert "0.00" in result and "1.00" in result  # min/max scale stated

    def test_zero_boost_character_has_lore_but_no_boost_annotation(self):
        result = self._fmt([{"name": "Bram", "lore": "Tavern keeper.", "score_boost": 0.0}])
        assert "Bram" in result
        assert "Tavern keeper." in result
        assert "boost" not in result  # no scale line, no per-character boost tag

    def test_lore_optional(self):
        result = self._fmt([{"name": "Ghost", "lore": "", "score_boost": 0.0}])
        assert "- Ghost" in result
        assert result.rstrip().endswith("== END CHARACTERS ==")

    def test_multiple_characters_listed(self):
        result = self._fmt([
            {"name": "Alara", "lore": "elf", "score_boost": 0.5},
            {"name": "Bram", "lore": "keeper", "score_boost": 0.0},
        ])
        assert "Alara" in result and "Bram" in result
        assert "[boost 0.50]" in result
        # Only the boosted one is tagged.
        assert result.count("[boost") == 1

    def test_missing_score_boost_key_treated_as_zero(self):
        result = self._fmt([{"name": "Alara", "lore": "elf"}])
        assert "[boost" not in result


# ---------------------------------------------------------------------------
# _format_duration
# ---------------------------------------------------------------------------

class TestFormatDuration:
    """_format_duration produces compact human-readable strings."""

    def _fmt(self, seconds):
        from yuu_clip.web.routes.analyze import _format_duration
        return _format_duration(seconds)

    def test_zero_seconds(self):
        assert self._fmt(0) == "0s"

    def test_under_one_minute(self):
        assert self._fmt(45) == "45s"

    def test_exactly_one_minute(self):
        assert self._fmt(60) == "1m 00s"

    def test_minutes_and_seconds(self):
        assert self._fmt(90) == "1m 30s"

    def test_exactly_one_hour(self):
        assert self._fmt(3600) == "1h 00m"

    def test_hours_and_minutes(self):
        assert self._fmt(5400) == "1h 30m"


# ---------------------------------------------------------------------------
# analyze/probe.py - _parse_fps
# ---------------------------------------------------------------------------

class TestParseFps:
    def _fps(self, s):
        from yuu_clip.analyze.probe import _parse_fps
        return _parse_fps(s)

    def test_integer_string(self):
        assert self._fps("30") == 30.0

    def test_fraction_string(self):
        result = self._fps("60000/1001")
        assert abs(result - 59.94) < 0.01

    def test_exact_fraction(self):
        assert self._fps("30/1") == 30.0

    def test_zero_denominator_returns_default(self):
        assert self._fps("30/0") == 30.0

    def test_invalid_string_returns_default(self):
        assert self._fps("not_a_number") == 30.0

    def test_empty_string_returns_default(self):
        assert self._fps("") == 30.0


# ---------------------------------------------------------------------------
# Video / ClipCandidate model property unit tests
# ---------------------------------------------------------------------------

class TestVideoDurationHms:
    def _video(self, duration_ms):
        from yuu_clip.db.models import Video
        return Video(path="/x", filename="x.mp4", status="done", duration_ms=duration_ms)

    def test_none_returns_unknown(self):
        assert self._video(None).duration_hms == "unknown"

    def test_zero_returns_zero_not_unknown(self):
        assert self._video(0).duration_hms == "0m 00s"

    def test_minutes_and_seconds(self):
        assert self._video(330_000).duration_hms == "5m 30s"

    def test_hours(self):
        assert self._video(3_723_000).duration_hms == "1h 02m 03s"


class TestClipCandidateProperties:
    def _clip(self, start_ms=0, end_ms=60_000):
        from yuu_clip.db.models import ClipCandidate
        return ClipCandidate(video_id=1, start_ms=start_ms, end_ms=end_ms)

    def test_duration_ms(self):
        assert self._clip(1_000, 4_000).duration_ms == 3_000

    def test_duration_hms_minutes(self):
        assert self._clip(0, 90_000).duration_hms == "1m 30s"

    def test_duration_hms_hours(self):
        assert self._clip(0, 3_661_000).duration_hms == "1h 01m 01s"

    def test_start_hms_no_hours(self):
        assert self._clip(start_ms=90_000).start_hms == "1:30"

    def test_start_hms_with_hours(self):
        assert self._clip(start_ms=3_661_000).start_hms == "1:01:01"

    def test_reasons_empty_when_null(self):
        assert self._clip().reasons == []

    def test_reasons_roundtrip(self):
        c = self._clip()
        c.reasons = ["funny", "action"]
        assert c.reasons == ["funny", "action"]

    def test_tags_empty_when_null(self):
        assert self._clip().tags == []

    def test_tags_roundtrip(self):
        c = self._clip()
        c.tags = ["llm_scored", "energy_scored"]
        assert c.tags == ["llm_scored", "energy_scored"]


class TestVideoEffectiveProperties:
    def _video(self, **kwargs):
        from yuu_clip.db.models import Video
        return Video(path="x.mkv", filename="x.mkv", **kwargs)

    def test_title_user_override_wins(self):
        assert self._video(title="LLM title", title_user="My title").effective_title == "My title"

    def test_title_falls_back_to_stored(self):
        assert self._video(title="LLM title").effective_title == "LLM title"

    def test_title_empty_user_override_wins(self):
        assert self._video(title="LLM title", title_user="").effective_title == ""

    def test_title_none_returns_empty_string(self):
        assert self._video().effective_title == ""

    def test_summary_user_override_wins(self):
        assert self._video(summary="LLM", summary_user="Mine").effective_summary == "Mine"

    def test_summary_none_returns_empty_string(self):
        assert self._video().effective_summary == ""


class TestClipEffectiveProperties:
    def _clip(self, **kwargs):
        from yuu_clip.db.models import ClipCandidate
        return ClipCandidate(video_id=1, start_ms=0, end_ms=1000, **kwargs)

    def test_description_user_override_wins(self):
        assert self._clip(description="LLM", description_user="Mine").effective_description == "Mine"

    def test_description_empty_user_override_wins(self):
        assert self._clip(description="LLM", description_user="").effective_description == ""

    def test_description_none_returns_empty_string(self):
        assert self._clip().effective_description == ""

    def test_description_long_user_override_wins(self):
        clip = self._clip(description_long="LLM long", description_long_user="Mine long")
        assert clip.effective_description_long == "Mine long"

    def test_description_long_none_returns_empty_string(self):
        assert self._clip().effective_description_long == ""


# ---------------------------------------------------------------------------
# common.py - json_list
# ---------------------------------------------------------------------------

class TestJsonList:
    def _fn(self, s):
        from yuu_clip.web.routes.common import json_list
        return json_list(s)

    def test_none_returns_empty(self):
        assert self._fn(None) == []

    def test_empty_string_returns_empty(self):
        assert self._fn("") == []

    def test_encoded_list_decoded(self):
        import json
        assert self._fn(json.dumps(["a", "b"])) == ["a", "b"]

    def test_encoded_empty_list(self):
        import json
        assert self._fn(json.dumps([])) == []


# ---------------------------------------------------------------------------
# common.py - analyze_in_flight / job_in_flight (bug-hunt 2.5: a queued-but-
# unlaunched /api/analyze/start command must count as busy too, closing the
# one-round-trip window where another heavy route's reject_if_busy would
# otherwise pass before /api/analyze/events launches the queued command).
# ---------------------------------------------------------------------------

class _FakeCtx:
    def __init__(self, analyze_cmd=None, analyze_job=None, analyze_proc=None,
                 active_jobs=0, proxy_generating=False):
        self.analyze_cmd = analyze_cmd
        self.analyze_job = analyze_job
        self.analyze_proc = analyze_proc
        self.active_jobs = active_jobs
        self.proxy_generating = proxy_generating


class TestAnalyzeInFlight:
    def _fn(self, ctx):
        from yuu_clip.web.routes.common import analyze_in_flight
        return analyze_in_flight(ctx)

    def test_idle_ctx_is_not_in_flight(self):
        assert self._fn(_FakeCtx()) is False

    def test_queued_but_unlaunched_command_counts_as_in_flight(self):
        assert self._fn(_FakeCtx(analyze_cmd=["python", "-m", "yuu_clip.cli"])) is True

    def test_running_analyze_job_counts_as_in_flight(self):
        from types import SimpleNamespace
        assert self._fn(_FakeCtx(analyze_job=SimpleNamespace(done=False))) is True

    def test_finished_analyze_job_does_not_count(self):
        from types import SimpleNamespace
        assert self._fn(_FakeCtx(analyze_job=SimpleNamespace(done=True))) is False

    def test_live_legacy_subprocess_counts_as_in_flight(self):
        from types import SimpleNamespace
        assert self._fn(_FakeCtx(analyze_proc=SimpleNamespace(returncode=None))) is True

    def test_exited_legacy_subprocess_does_not_count(self):
        from types import SimpleNamespace
        assert self._fn(_FakeCtx(analyze_proc=SimpleNamespace(returncode=0))) is False


class TestJobInFlight:
    def _fn(self, ctx):
        from yuu_clip.web.routes.common import job_in_flight
        return job_in_flight(ctx)

    def test_idle_ctx_is_not_busy(self):
        assert self._fn(_FakeCtx()) is False

    def test_queued_but_unlaunched_analyze_makes_the_app_busy(self):
        # The exact race this fix closes: another route's reject_if_busy must
        # see the app as busy during the window between /api/analyze/start
        # queuing the command and /api/analyze/events launching it.
        assert self._fn(_FakeCtx(analyze_cmd=["python", "-m", "yuu_clip.cli"])) is True

    def test_counted_job_makes_the_app_busy(self):
        assert self._fn(_FakeCtx(active_jobs=1)) is True

    def test_proxy_generation_makes_the_app_busy(self):
        assert self._fn(_FakeCtx(proxy_generating=True)) is True

