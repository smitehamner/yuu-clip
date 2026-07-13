"""yuu_clip/scoring/describe_basic.py - the non-LLM template one-liner (Stage 02)."""
from __future__ import annotations

from types import SimpleNamespace


def _clip(excerpt, funny=0.0, dramatic=0.0, action=0.0, visual=0.0, tags=None):
    return SimpleNamespace(
        transcript_excerpt=excerpt,
        score_funny=funny, score_dramatic=dramatic, score_action=action,
        score_visual=visual, tags=tags or [],
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

    def test_textless_visual_clip_gets_silent_moment_template(self):
        from yuu_clip.scoring.describe_basic import build_basic_description
        clip = _clip("", visual=0.8, tags=["visual", "no_speech"])
        description, description_long = build_basic_description(clip)
        assert description == "Silent visual moment - high on-screen activity"
        assert description_long == ""

    def test_textless_visual_clip_low_activity_still_described(self):
        from yuu_clip.scoring.describe_basic import build_basic_description
        clip = _clip("", visual=0.05, tags=["visual", "no_speech"])
        description, _ = build_basic_description(clip)
        assert description == "Silent visual moment - low on-screen activity"

    def test_textless_non_visual_clip_stays_blank(self):
        # An empty excerpt with no "visual" tag is the pre-existing blank case -
        # a textless clip must carry the tag to earn the template.
        from yuu_clip.scoring.describe_basic import build_basic_description
        clip = _clip("", visual=0.9, tags=["no_speech"])
        assert build_basic_description(clip) == ("", "")

    def test_talk_clip_with_visual_tag_is_unaffected(self):
        # A clip with both transcript AND a "visual" tag is not textless - the normal
        # speaker/keyword/dimension template still wins.
        from yuu_clip.scoring.describe_basic import build_basic_description
        clip = _clip("Yuu: we pulled off the heist", action=0.7, visual=0.9, tags=["visual"])
        description, _ = build_basic_description(clip)
        assert "Silent visual moment" not in description
        assert "Yuu" in description and "heist" in description


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
