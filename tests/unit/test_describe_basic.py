"""yuu_clip/scoring/describe_basic.py - the non-LLM template one-liner (Stage 02)."""
from __future__ import annotations

from types import SimpleNamespace


def _clip(excerpt, funny=0.0, dramatic=0.0, action=0.0):
    return SimpleNamespace(
        transcript_excerpt=excerpt,
        score_funny=funny, score_dramatic=dramatic, score_action=action,
    )


class TestBuildBasicDescription:
    def test_names_speakers_and_keywords(self):
        from yuu_clip.scoring.describe_basic import build_basic_description
        clip = _clip("Yuu: we pulled off the heist\nAlex: the getaway was clean", action=0.7)
        description, description_long = build_basic_description(clip)
        assert "Yuu" in description and "Alex" in description
        assert "heist" in description
        assert description_long == ""

    def test_leading_dimension_band(self):
        from yuu_clip.scoring.describe_basic import build_basic_description
        clip = _clip("Yuu: clutch play there", action=0.8)
        description, _ = build_basic_description(clip)
        assert "high action" in description

    def test_weak_dimension_omitted(self):
        from yuu_clip.scoring.describe_basic import build_basic_description
        clip = _clip("Yuu: clutch play there", action=0.1)
        description, _ = build_basic_description(clip)
        assert "action" not in description

    def test_deterministic(self):
        from yuu_clip.scoring.describe_basic import build_basic_description
        clip = _clip("Yuu: we pulled off the heist\nAlex: the getaway was clean", action=0.7)
        assert build_basic_description(clip) == build_basic_description(clip)

    def test_anonymous_speaker_labels_dropped(self):
        from yuu_clip.scoring.describe_basic import build_basic_description
        clip = _clip("Speaker 1: the ambush was wild", action=0.5)
        description, _ = build_basic_description(clip)
        assert "Speaker 1" not in description
        assert "ambush" in description

    def test_empty_excerpt_returns_blank(self):
        from yuu_clip.scoring.describe_basic import build_basic_description
        assert build_basic_description(_clip("")) == ("", "")
        assert build_basic_description(_clip("   \n  ")) == ("", "")
        assert build_basic_description(_clip(None)) == ("", "")

    def test_dimension_only_when_no_text_content(self):
        # Stopword-only excerpt yields no keywords/speakers, so a strong dimension
        # is the honest floor - capitalized, never blank.
        from yuu_clip.scoring.describe_basic import build_basic_description
        clip = _clip("the and of to", action=0.9)
        description, _ = build_basic_description(clip)
        assert description == "High action"


class TestTopKeywords:
    def test_ranks_by_frequency_then_first_seen(self):
        from yuu_clip.scoring.similarity import top_keywords
        assert top_keywords("heist heist getaway clean", 2) == ["heist", "getaway"]

    def test_drops_stopwords(self):
        from yuu_clip.scoring.similarity import top_keywords
        assert top_keywords("the and of to", 3) == []

    def test_empty_returns_empty(self):
        from yuu_clip.scoring.similarity import top_keywords
        assert top_keywords("", 3) == []
