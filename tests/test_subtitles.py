"""Unit tests - word-highlight ASS rendering (subtitles.lines_to_ass, Stage 3).

Covers chunk boundaries, the per-word highlight/colour math, the static fallback
for lines with no word data, and multi-speaker distinct highlight tones.
"""
from __future__ import annotations

import re

from yuu_clip.subtitles import (
    SubLine,
    _highlight_shade,
    _parse_hex,
    lines_to_ass,
)


def _word(text: str, start: int, end: int) -> dict:
    return {"text": text, "start_ms": start, "end_ms": end}


def _dialogue_lines(ass: str) -> list[str]:
    return [line for line in ass.splitlines() if line.startswith("Dialogue:")]


def _text_field(dialogue: str) -> str:
    # Dialogue: Layer,Start,End,Style,Name,ML,MR,MV,Effect,Text - Text is field 10.
    return dialogue.split(",", 9)[9]


class TestHighlightShade:
    def test_brightens_mid_tone_speaker_colour_toward_white(self):
        # #4fc3f7 -> each channel averaged with 255.
        assert _highlight_shade("#4fc3f7") == "#a7e1fb"

    def test_near_white_base_falls_back_to_gold(self):
        assert _highlight_shade("#ffffff") == "#ffd54f"

    def test_distinct_speakers_get_distinct_highlights(self):
        assert _highlight_shade("#4fc3f7") != _highlight_shade("#f0c060")


class TestParseHex:
    def test_parses_rrggbb(self):
        assert _parse_hex("#4fc3f7") == (0x4f, 0xc3, 0xf7)


class TestLinesToAss:
    def test_has_ass_header_and_playres(self):
        ass = lines_to_ass([], chunk_size=4, play_res=(1920, 1080))
        assert "[Script Info]" in ass
        assert "PlayResX: 1920" in ass
        assert "PlayResY: 1080" in ass
        assert "[V4+ Styles]" in ass
        assert "[Events]" in ass

    def test_line_without_word_data_renders_one_static_event(self):
        line = SubLine(0, 2000, "hello world", "", None, "")
        events = _dialogue_lines(lines_to_ass([line], chunk_size=4))
        assert len(events) == 1
        assert "hello world" in _text_field(events[0])

    def test_one_event_per_word(self):
        line = SubLine(
            0, 2000, "a b c", "", None, "",
            words=(_word("a", 0, 300), _word("b", 300, 600), _word("c", 600, 900)),
        )
        events = _dialogue_lines(lines_to_ass([line], chunk_size=4))
        assert len(events) == 3

    def test_chunk_size_splits_words(self):
        words = tuple(_word(f"w{i}", i * 100, i * 100 + 100) for i in range(5))
        line = SubLine(0, 500, "w0 w1 w2 w3 w4", "", None, "", words=words)
        # chunk_size=2 -> chunks [w0,w1] [w2,w3] [w4] = still one event per word = 5.
        events = _dialogue_lines(lines_to_ass([line], chunk_size=2))
        assert len(events) == 5
        # First chunk's two events both show only "w0 w1"; neither shows "w2".
        first_two = [_text_field(e) for e in events[:2]]
        assert all("w2" not in text for text in first_two)
        assert all("w0" in text and "w1" in text for text in first_two)

    def test_active_word_is_recoloured_and_advances(self):
        line = SubLine(
            0, 600, "one two", "", None, "",
            words=(_word("one", 0, 300), _word("two", 300, 600)),
        )
        events = _dialogue_lines(lines_to_ass([line], chunk_size=4))
        # Event 0 highlights "one" (override immediately precedes it), event 1 "two".
        assert re.search(r"\{\\1c[^}]+\}one", _text_field(events[0]))
        assert re.search(r"\{\\1c[^}]+\}two", _text_field(events[1]))

    def test_event_runs_until_next_word_starts(self):
        line = SubLine(
            0, 900, "one two", "", None, "",
            words=(_word("one", 0, 300), _word("two", 500, 900)),
        )
        events = _dialogue_lines(lines_to_ass([line], chunk_size=4))
        # "one" event ends when "two" starts (0.50s), not at its own end (0.30s).
        assert "0:00:00.00,0:00:00.50" in events[0]
        # last word runs to its own end (0.90s).
        assert "0:00:00.50,0:00:00.90" in events[1]

    def test_speaker_prefix_present_when_set(self):
        line = SubLine(0, 500, "hi", "Yuu", None, "#4fc3f7", words=(_word("hi", 0, 500),))
        events = _dialogue_lines(lines_to_ass([line], chunk_size=4))
        assert "[Yuu] " in _text_field(events[0])

    def test_multi_speaker_lines_use_distinct_base_colours(self):
        blue = SubLine(0, 500, "a", "A", None, "#4fc3f7", words=(_word("a", 0, 500),))
        gold = SubLine(500, 1000, "b", "B", None, "#f0c060", words=(_word("b", 500, 1000),))
        events = _dialogue_lines(lines_to_ass([blue, gold], chunk_size=4))
        # ASS colour override is &H00BBGGRR - blue and gold produce different overrides.
        assert "&H00F7C34F" in _text_field(events[0])
        assert "&H0060C0F0" in _text_field(events[1])

    def test_braces_in_text_are_neutralised(self):
        line = SubLine(0, 500, "no {override} here", "", None, "")
        events = _dialogue_lines(lines_to_ass([line], chunk_size=4))
        text = _text_field(events[0])
        # No literal caption-supplied braces survive beyond the leading colour override.
        assert "{override}" not in text
        assert "(override)" in text
