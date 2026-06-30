"""
Pure utility / logic functions in yuu_clip/web/static/*.js.

These exercise the real served code via the browser's global scope rather than
a separate JS runtime, so they require the live server like the rest of the UI
suite. Assertions are timezone-independent: they compare two JS values computed
in the same engine, never against a host-clock-derived constant.

Run against the live dev server on port 8080. See tests/conftest.py for shared
helpers.
"""
from __future__ import annotations

from playwright.sync_api import Page

from conftest import skip_no_server


# ---------------------------------------------------------------------------
# Format / date helpers (utils.js)
# ---------------------------------------------------------------------------

@skip_no_server
class TestJsUtils:
    def test_eschtml_escapes_quote_for_attributes(self, page: Page):
        # The double-quote escape is load-bearing for data-*/title attributes.
        out = page.evaluate("() => escHtml('a \"b\" <c> & d')")
        assert out == "a &quot;b&quot; &lt;c&gt; &amp; d"

    def test_parse_server_date_treats_naive_as_utc(self, page: Page):
        # Regression: naive (zone-less) server timestamps must be read as UTC,
        # not the viewer's local time. A naive string and its Z-suffixed twin
        # must parse to the same instant regardless of the browser timezone.
        same = page.evaluate(
            "() => _parseServerDate('2026-06-29T12:00:00').getTime()"
            "    === _parseServerDate('2026-06-29T12:00:00Z').getTime()"
        )
        assert same is True

    def test_parse_server_date_keeps_explicit_offset(self, page: Page):
        # An ISO string already carrying an offset must not be corrupted by a
        # spurious appended 'Z' (which would yield an Invalid Date / NaN).
        result = page.evaluate(
            "() => {"
            "  const offset = _parseServerDate('2026-06-29T12:00:00+02:00').getTime();"
            "  const utc    = _parseServerDate('2026-06-29T10:00:00Z').getTime();"
            "  return {finite: Number.isFinite(offset), equal: offset === utc};"
            "}"
        )
        assert result == {"finite": True, "equal": True}

    def test_fmt_ago_uses_utc_for_naive_timestamps(self, page: Page):
        # Build a naive-UTC string ~2h in the past (mirrors the server's format)
        # and assert the elapsed label is correct independent of local timezone.
        label = page.evaluate(
            "() => {"
            "  const d = new Date(Date.now() - 2 * 3600 * 1000);"
            "  const naive = d.toISOString().replace(/\\.\\d+Z$/, '');"
            "  return _fmtAgo(naive);"
            "}"
        )
        assert label == "2h ago"

    def test_fmt_offset_handles_zero_and_sign(self, page: Page):
        # Zero is a valid offset, not "missing" — must render as +0.0.
        result = page.evaluate(
            "() => [_fmtOffset(0), _fmtOffset(1.2), _fmtOffset(-3.5)]"
        )
        assert result == ["+0.0", "+1.2", "-3.5"]

    def test_ms_to_hms_formats_minutes_and_seconds(self, page: Page):
        result = page.evaluate("() => [_msToHms(5000), _msToHms(65000)]")
        assert result == ["5s", "1m 05s"]


# ---------------------------------------------------------------------------
# formatApiError (utils.js)
# ---------------------------------------------------------------------------

@skip_no_server
class TestFormatApiError:
    def test_null_returns_unknown(self, page: Page):
        assert page.evaluate("() => formatApiError(null)") == "Unknown error"

    def test_string_detail_passed_through(self, page: Page):
        out = page.evaluate("() => formatApiError({detail: 'File not found'})")
        assert out == "File not found"

    def test_array_detail_joins_messages(self, page: Page):
        # FastAPI 422 validation errors arrive as detail: [{msg, loc, ...}, ...]
        out = page.evaluate(
            "() => formatApiError({detail: [{msg: 'field required'}, {msg: 'too long'}]})"
        )
        assert out == "field required; too long"

    def test_array_detail_entry_without_msg_falls_back_to_json(self, page: Page):
        out = page.evaluate("() => formatApiError({detail: [{code: 7}]})")
        assert out == '{"code":7}'

    def test_object_without_detail_uses_message(self, page: Page):
        out = page.evaluate("() => formatApiError({message: 'boom'})")
        assert out == "boom"

    def test_object_without_detail_or_message_stringifies(self, page: Page):
        out = page.evaluate("() => formatApiError({status: 500})")
        assert out == '{"status":500}'


# ---------------------------------------------------------------------------
# stripRichMarkup (utils.js)
# ---------------------------------------------------------------------------

@skip_no_server
class TestStripRichMarkup:
    def test_removes_ansi_escape_codes(self, page: Page):
        # \x1b[32m ... \x1b[0m wraps the text in a green ANSI color.
        out = page.evaluate(r"() => stripRichMarkup('\x1b[32mdone\x1b[0m')")
        assert out == "done"

    def test_removes_rich_markup_tags(self, page: Page):
        out = page.evaluate("() => stripRichMarkup('[green]OK[/green] and [bold]bold[/bold]')")
        assert out == "OK and bold"

    def test_plain_text_unchanged(self, page: Page):
        out = page.evaluate("() => stripRichMarkup('just plain text 12:34')")
        assert out == "just plain text 12:34"


# ---------------------------------------------------------------------------
# _scoreBorderColor / _lerpColor (utils.js)
# ---------------------------------------------------------------------------

@skip_no_server
class TestScoreBorderColor:
    def test_rejected_is_muted_regardless_of_score(self, page: Page):
        out = page.evaluate("() => _scoreBorderColor(0.95, true)")
        assert out == "var(--muted)"

    def test_landmark_stops_interpolate_to_exact_color(self, page: Page):
        # At a stop boundary (t=0) the colour is the stop colour exactly.
        # 0.3 → #4fc3f7 = rgb(79,195,247).
        out = page.evaluate("() => _scoreBorderColor(0.3, false)")
        assert out == "rgb(79,195,247)"

    def test_top_of_range_is_final_stop(self, page: Page):
        # Score 1.0 → final stop #f7a85a = rgb(247,168,90).
        out = page.evaluate("() => _scoreBorderColor(1.0, false)")
        assert out == "rgb(247,168,90)"

    def test_midpoint_blends_between_stops(self, page: Page):
        # Halfway between 0.3 (#4fc3f7) and 0.5 (#4caf7d) is score 0.4.
        # Verify the result is a blend strictly between the two endpoints.
        result = page.evaluate(
            "() => {"
            "  const parse = s => s.match(/\\d+/g).map(Number);"
            "  const lo = parse(_scoreBorderColor(0.3, false));"
            "  const mid = parse(_scoreBorderColor(0.4, false));"
            "  const hi = parse(_scoreBorderColor(0.5, false));"
            "  const between = mid.every((v, i) =>"
            "    v >= Math.min(lo[i], hi[i]) && v <= Math.max(lo[i], hi[i]));"
            "  const distinct = mid.join() !== lo.join() && mid.join() !== hi.join();"
            "  return {between, distinct};"
            "}"
        )
        assert result == {"between": True, "distinct": True}

    def test_lerp_endpoints_are_exact(self, page: Page):
        result = page.evaluate(
            "() => ["
            "  _lerpColor('#000000', '#ffffff', 0),"
            "  _lerpColor('#000000', '#ffffff', 1),"
            "  _lerpColor('#000000', '#ffffff', 0.5),"
            "]"
        )
        assert result == ["rgb(0,0,0)", "rgb(255,255,255)", "rgb(128,128,128)"]


# ---------------------------------------------------------------------------
# _parseTimingOffset (clips.js)
# ---------------------------------------------------------------------------

@skip_no_server
class TestParseTimingOffset:
    def _set_clip_start(self, page: Page, start_ms) -> None:
        page.evaluate(f"() => {{ AppState.activeClipData = {{start_ms: {start_ms}}}; }}")

    def test_empty_string_is_zero(self, page: Page):
        assert page.evaluate("() => _parseTimingOffset('')") == 0.0

    def test_signed_value_is_relative(self, page: Page):
        # A leading +/- means a clip-relative nudge, independent of clip start.
        self._set_clip_start(page, 60_000)
        assert page.evaluate("() => _parseTimingOffset('+2.5')") == 2.5
        assert page.evaluate("() => _parseTimingOffset('-1.5')") == -1.5

    def test_absolute_mmss_is_converted_to_clip_relative(self, page: Page):
        # Clip starts at 60s. Absolute "1:10" = 70s → +10s relative.
        self._set_clip_start(page, 60_000)
        assert page.evaluate("() => _parseTimingOffset('1:10')") == 10.0

    def test_absolute_mmss_before_clip_start_is_negative(self, page: Page):
        # Clip starts at 90s. Absolute "1:00" = 60s → -30s relative.
        self._set_clip_start(page, 90_000)
        assert page.evaluate("() => _parseTimingOffset('1:00')") == -30.0

    def test_bare_number_parsed_directly(self, page: Page):
        self._set_clip_start(page, 60_000)
        assert page.evaluate("() => _parseTimingOffset('4.25')") == 4.25


# ---------------------------------------------------------------------------
# _parseSplitTime / _fmtSplitTime (split.js)
# ---------------------------------------------------------------------------

@skip_no_server
class TestSplitTime:
    def test_parse_mmss(self, page: Page):
        assert page.evaluate("() => _parseSplitTime('2:05')") == 125

    def test_parse_hmmss(self, page: Page):
        assert page.evaluate("() => _parseSplitTime('1:02:03')") == 3723

    def test_parse_bare_seconds(self, page: Page):
        assert page.evaluate("() => _parseSplitTime('42')") == 42

    def test_parse_invalid_returns_null(self, page: Page):
        # NaN guard: a non-numeric part must yield null, not NaN.
        assert page.evaluate("() => _parseSplitTime('1:ab')") is None

    def test_fmt_mmss_pads_seconds(self, page: Page):
        assert page.evaluate("() => _fmtSplitTime(125)") == "2:05"

    def test_fmt_hmmss_above_one_hour(self, page: Page):
        assert page.evaluate("() => _fmtSplitTime(3723)") == "1:02:03"

    def test_round_trips_through_parse_and_format(self, page: Page):
        result = page.evaluate(
            "() => ['0:30', '9:59', '1:00:00', '2:34:56'].map("
            "  s => _fmtSplitTime(_parseSplitTime(s)) === s)"
        )
        assert result == [True, True, True, True]


# ---------------------------------------------------------------------------
# _applyFilters (clips.js)
# ---------------------------------------------------------------------------

@skip_no_server
class TestApplyFilters:
    _SEED = """() => {
      AppState.clips = [
        {id: 1, status: 'pending',  score_overall: 0,   description: 'alpha funny'},
        {id: 2, status: 'approved', score_overall: 0.8, description: 'beta',
         description_long: 'longer beta text'},
        {id: 3, status: 'rejected', score_overall: 0.3, description: 'gamma',
         transcript_excerpt: 'spoken keyword here'},
      ];
      AppState.clipFilter = 'all'; AppState.clipScoreMin = 0; AppState.clipSearch = '';
    }"""

    def test_no_filters_returns_all_including_score_zero(self, page: Page):
        # Score 0 is a real score, not "missing" — it must survive the no-filter pass.
        ids = page.evaluate(
            f"() => {{ ({self._SEED})();"
            "  return _applyFilters().map(c => c.id); }"
        )
        assert ids == [1, 2, 3]

    def test_status_filter_selects_one(self, page: Page):
        ids = page.evaluate(
            f"() => {{ ({self._SEED})(); AppState.clipFilter = 'approved';"
            "  return _applyFilters().map(c => c.id); }"
        )
        assert ids == [2]

    def test_score_min_excludes_zero_and_below_threshold(self, page: Page):
        # min 0.5 keeps only the 0.8 clip; score 0 and 0.3 are excluded.
        ids = page.evaluate(
            f"() => {{ ({self._SEED})(); AppState.clipScoreMin = 0.5;"
            "  return _applyFilters().map(c => c.id); }"
        )
        assert ids == [2]

    def test_score_min_zero_does_not_filter(self, page: Page):
        # AppState.clipScoreMin must use a > 0 gate so a min of 0 keeps the score-0 clip.
        ids = page.evaluate(
            f"() => {{ ({self._SEED})(); AppState.clipScoreMin = 0;"
            "  return _applyFilters().map(c => c.id); }"
        )
        assert ids == [1, 2, 3]

    def test_search_matches_description(self, page: Page):
        ids = page.evaluate(
            f"() => {{ ({self._SEED})(); AppState.clipSearch = 'alpha';"
            "  return _applyFilters().map(c => c.id); }"
        )
        assert ids == [1]

    def test_search_matches_long_description_and_transcript(self, page: Page):
        long_ids = page.evaluate(
            f"() => {{ ({self._SEED})(); AppState.clipSearch = 'longer';"
            "  return _applyFilters().map(c => c.id); }"
        )
        transcript_ids = page.evaluate(
            f"() => {{ ({self._SEED})(); AppState.clipSearch = 'spoken';"
            "  return _applyFilters().map(c => c.id); }"
        )
        assert long_ids == [2]
        assert transcript_ids == [3]

    def test_search_is_case_insensitive(self, page: Page):
        ids = page.evaluate(
            f"() => {{ ({self._SEED})(); AppState.clipSearch = 'GAMMA';"
            "  return _applyFilters().map(c => c.id); }"
        )
        assert ids == [3]


# ---------------------------------------------------------------------------
# _computeSuggestionPins (split.js)
# ---------------------------------------------------------------------------

@skip_no_server
class TestComputeSuggestionPins:
    def _run(self, page: Page, setup_js: str):
        return page.evaluate(
            "() => {"
            f"  {setup_js}"
            "  _suggestionPins = [];"
            "  _computeSuggestionPins();"
            "  return _suggestionPins;"
            "}"
        )

    def test_picks_quietest_seconds(self, page: Page):
        # The two clear quiet valleys (lowest rms_db) well inside the duration
        # and far apart must both make the cut. (The greedy pick also fills
        # remaining slots with other spaced seconds — we only assert the valleys
        # are present and the spacing/count invariants hold.)
        pins = self._run(
            page,
            "_splitDurationS = 200;"
            "_splitEnergyFlat = Array.from({length: 200}, (_, i) => ({"
            "  second: i, rms_db: (i === 50 || i === 150) ? -90 : -10}));",
        )
        assert 50 in pins
        assert 150 in pins
        assert len(pins) <= 8
        assert all(b - a >= 30 for a, b in zip(pins, pins[1:]))

    def test_respects_min_gap(self, page: Page):
        # Two equally-quiet seconds closer than the 30s min gap: the earlier one
        # wins, the closer one is suppressed, and no two pins end up within 30s.
        pins = self._run(
            page,
            "_splitDurationS = 200;"
            "_splitEnergyFlat = Array.from({length: 200}, (_, i) => ({"
            "  second: i, rms_db: (i === 50 || i === 60) ? -90 : -10}));",
        )
        assert 50 in pins
        assert 60 not in pins
        assert all(b - a >= 30 for a, b in zip(pins, pins[1:]))

    def test_excludes_endpoints(self, page: Page):
        # The quietest seconds are the very first and last — both must be skipped
        # because a split at 0 or at the duration is meaningless.
        pins = self._run(
            page,
            "_splitDurationS = 100;"
            "_splitEnergyFlat = Array.from({length: 101}, (_, i) => ({"
            "  second: i, rms_db: (i === 0 || i === 100) ? -90 : -10}));",
        )
        assert 0 not in pins
        assert 100 not in pins

    def test_caps_at_suggestion_count(self, page: Page):
        # Many well-spaced quiet valleys, but the pin count is capped at 8.
        pins = self._run(
            page,
            "_splitDurationS = 1000;"
            "_splitEnergyFlat = Array.from({length: 1000}, (_, i) => ({"
            "  second: i, rms_db: (i % 40 === 0 && i > 0) ? -90 : -10}));",
        )
        assert len(pins) <= 8

    def test_returns_sorted_ascending(self, page: Page):
        pins = self._run(
            page,
            "_splitDurationS = 300;"
            "_splitEnergyFlat = Array.from({length: 300}, (_, i) => ({"
            "  second: i, rms_db: [40, 120, 200, 280].includes(i) ? -90 : -10}));",
        )
        assert pins == sorted(pins)

    def test_empty_energy_is_a_noop(self, page: Page):
        # Guard: with no energy data the function returns early and leaves any
        # existing pins untouched (rather than clearing them).
        pins = page.evaluate(
            "() => {"
            "  _splitDurationS = 200; _splitEnergyFlat = [];"
            "  _suggestionPins = [42]; _computeSuggestionPins();"
            "  return _suggestionPins;"
            "}"
        )
        assert pins == [42]

    def test_zero_duration_is_a_noop(self, page: Page):
        # A zero-length clip has no interior seconds — early return, pins untouched.
        pins = page.evaluate(
            "() => {"
            "  _splitDurationS = 0;"
            "  _splitEnergyFlat = [{second: 1, rms_db: -10}];"
            "  _suggestionPins = [7]; _computeSuggestionPins();"
            "  return _suggestionPins;"
            "}"
        )
        assert pins == [7]

    def test_all_equal_energy_still_picks_spaced_in_bounds_pins(self, page: Page):
        # Every second has identical energy: the dB range collapses to 0 and must
        # fall back to 1 (no divide-by-zero / NaN). All scores tie, so the greedy
        # pass just fills spaced, interior slots up to the cap.
        pins = self._run(
            page,
            "_splitDurationS = 300;"
            "_splitEnergyFlat = Array.from({length: 300}, (_, i) => ({"
            "  second: i, rms_db: -10}));",
        )
        assert pins, "expected at least one suggestion for a non-trivial duration"
        assert all(0 < p < 300 for p in pins)
        assert all(b - a >= 30 for a, b in zip(pins, pins[1:]))
        assert len(pins) <= 8


# ---------------------------------------------------------------------------
# Active-stream supersede contract (utils.js)
#
# Regression: when a second long-running job starts while a first is mid-stream,
# the first stream is aborted — but abort suppresses its onDone/onError, so its
# UI teardown (re-enabling the triggering button) must be run by the superseding
# job via the registered cleanup. Without this the first button stays disabled.
# ---------------------------------------------------------------------------

@skip_no_server
class TestActiveStreamSupersede:
    def test_supersede_aborts_handle_and_runs_cleanup(self, page: Page):
        result = page.evaluate(
            "() => {"
            "  const btn = document.createElement('button');"
            "  btn.disabled = true;"          # first job disabled its button
            "  let aborted = false;"
            "  const handle1 = {close: () => { aborted = true; }};"
            "  _setActiveStream(handle1, () => { btn.disabled = false; });"
            "  _supersedeActiveStream();"      # second job starts → supersede
            "  return {aborted, btnEnabled: !btn.disabled, esCleared: _activeES === null};"
            "}"
        )
        assert result == {"aborted": True, "btnEnabled": True, "esCleared": True}

    def test_clear_only_clears_matching_handle(self, page: Page):
        # A stale stream's onDone must not wipe out a newer active stream.
        result = page.evaluate(
            "() => {"
            "  const older = {close: () => {}};"
            "  const newer = {close: () => {}};"
            "  _setActiveStream(newer, null);"
            "  _clearActiveStream(older);"      # older completing late
            "  const kept = _activeES === newer;"
            "  _clearActiveStream(newer);"
            "  const cleared = _activeES === null;"
            "  return {kept, cleared};"
            "}"
        )
        assert result == {"kept": True, "cleared": True}

    def test_supersede_runs_cleanup_only_once(self, page: Page):
        # The cleanup must not run again on a second supersede with nothing active.
        count = page.evaluate(
            "() => {"
            "  let runs = 0;"
            "  _setActiveStream({close: () => {}}, () => { runs += 1; });"
            "  _supersedeActiveStream();"
            "  _supersedeActiveStream();"
            "  return runs;"
            "}"
        )
        assert count == 1


# ---------------------------------------------------------------------------
# _fmtElapsed (utils.js) — short job-timer label
# ---------------------------------------------------------------------------

@skip_no_server
class TestFmtElapsed:
    def test_under_a_minute_is_seconds_only(self, page: Page):
        result = page.evaluate(
            "() => [_fmtElapsed(0), _fmtElapsed(5000), _fmtElapsed(59000)]"
        )
        assert result == ["0s", "5s", "59s"]

    def test_minute_boundary_and_no_zero_pad(self, page: Page):
        # Unlike _msToHms, the seconds part is NOT zero-padded: 65s → "1m 5s".
        result = page.evaluate("() => [_fmtElapsed(60000), _fmtElapsed(65000)]")
        assert result == ["1m 0s", "1m 5s"]

    def test_no_hour_rollover(self, page: Page):
        # _fmtElapsed has no hour unit (it labels short job timers); 61 min stays
        # "61m 1s" rather than rolling into "1h ...".
        assert page.evaluate("() => _fmtElapsed(3661000)") == "61m 1s"


# ---------------------------------------------------------------------------
# _fmtVideoStatus (utils.js) — status-map with raw fallback
# ---------------------------------------------------------------------------

@skip_no_server
class TestFmtVideoStatus:
    def test_known_status_maps_to_display_label(self, page: Page):
        result = page.evaluate(
            "() => [_fmtVideoStatus('done'), _fmtVideoStatus('pending')]"
        )
        assert result == ["Analyzed", "Not analyzed"]

    def test_unknown_status_falls_through_to_raw(self, page: Page):
        # Defensive fallback: an unmapped status renders verbatim, never blank.
        assert page.evaluate("() => _fmtVideoStatus('frobnicate')") == "frobnicate"


# ---------------------------------------------------------------------------
# _sortScore (utils.js) — score dimension picked from the sort dropdown
# ---------------------------------------------------------------------------

@skip_no_server
class TestSortScore:
    _CLIP = (
        "{score_overall: 0.5, score_funny: 0.9, "
        "score_dramatic: 0.4, score_action: 0.3}"
    )

    def _sort_by(self, page: Page, sort_value: str):
        return page.evaluate(
            "(v) => { document.getElementById('clips-sort').value = v;"
            f"  return _sortScore({self._CLIP}); }}",
            sort_value,
        )

    def test_dimension_selects_matching_field(self, page: Page):
        assert self._sort_by(page, "funny") == 0.9
        assert self._sort_by(page, "dramatic") == 0.4
        assert self._sort_by(page, "action") == 0.3

    def test_score_uses_overall(self, page: Page):
        assert self._sort_by(page, "score") == 0.5

    def test_non_dimension_sort_falls_back_to_overall(self, page: Page):
        # 'timeline' is a valid sort but not a score dimension — rank by overall.
        assert self._sort_by(page, "timeline") == 0.5


# ---------------------------------------------------------------------------
# _fmtDate (utils.js) — timezone-independent assertions only
# ---------------------------------------------------------------------------

@skip_no_server
class TestFmtDate:
    def test_missing_is_never(self, page: Page):
        result = page.evaluate("() => [_fmtDate(null), _fmtDate('')]")
        assert result == ["never", "never"]

    def test_valid_date_uses_at_separator(self, page: Page):
        # The literal ' at ' joiner is hard-coded, so this holds in any timezone;
        # the surrounding date/time text is locale-formatted and not asserted.
        out = page.evaluate("() => _fmtDate('2026-06-29T12:00:00')")
        assert " at " in out

    def test_distinct_inputs_format_distinctly(self, page: Page):
        # Two timestamps six months apart must not collapse to the same label
        # regardless of the viewer's timezone offset.
        differ = page.evaluate(
            "() => _fmtDate('2026-06-29T12:00:00') "
            "    !== _fmtDate('2026-01-02T08:30:00')"
        )
        assert differ is True


# ---------------------------------------------------------------------------
# updateJobUI (utils.js) — step advancement marks prior done, current active
# ---------------------------------------------------------------------------

@skip_no_server
class TestUpdateJobUI:
    # SCORE_STEPS = [Energy, Scenes, Scoring]. updateJobUI matches a log line to a
    # step, marks every earlier step done, and marks the matched step active.
    def _classes_after(self, page: Page, line: str):
        return page.evaluate(
            "(line) => {"
            "  startJobUI(SCORE_STEPS, 'Re-scoring clip');"
            "  updateJobUI(line);"
            "  const cls = i => document.getElementById('step-' + i).className;"
            "  const out = [cls(0), cls(1), cls(2)];"
            "  endJobUI();"  # clear the interval timer started by startJobUI
            "  return out;"
            "}",
            line,
        )

    def test_middle_step_marks_prior_done_and_self_active(self, page: Page):
        # A 'Detecting scene' line is step 1: step 0 done, step 1 active, step 2
        # still pending.
        assert self._classes_after(page, "Detecting scene changes") == [
            "step done", "step active", "step",
        ]

    def test_final_step_marks_all_prior_done(self, page: Page):
        assert self._classes_after(page, "Scoring clips now") == [
            "step done", "step done", "step active",
        ]


# ---------------------------------------------------------------------------
# _parseWeight (contexts.js) — input parse with NaN→null and negative clamp
# ---------------------------------------------------------------------------

@skip_no_server
class TestParseWeight:
    def _weight(self, page: Page, raw: str):
        return page.evaluate(
            "(raw) => {"
            "  let el = document.getElementById('__test_weight');"
            "  if (!el) { el = document.createElement('input');"
            "    el.id = '__test_weight'; document.body.appendChild(el); }"
            "  el.value = raw;"
            "  const out = _parseWeight('__test_weight');"
            "  el.remove();"
            "  return out;"
            "}",
            raw,
        )

    def test_parses_positive_value(self, page: Page):
        assert self._weight(page, "2.5") == 2.5

    def test_blank_or_nonnumeric_is_null(self, page: Page):
        assert self._weight(page, "") is None
        assert self._weight(page, "abc") is None

    def test_negative_is_clamped_to_zero(self, page: Page):
        # A relevance weight must never go below 0 even if the field holds one.
        assert self._weight(page, "-5") == 0
