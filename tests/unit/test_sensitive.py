"""Sensitive content detection (roadmap plan 06) - fuzzy matcher,
apply_sensitive_scan, and ScoringEngine integration.

Client-bound CRUD/rescan route tests (incl. the term-values-never-logged
guard) live in tests/integration/test_sensitive.py."""
from __future__ import annotations

# ---------------------------------------------------------------------------
# textmatch.find_fuzzy_matches
# ---------------------------------------------------------------------------

class TestFindFuzzyMatches:
    def _term(self, phrase):
        from yuu_clip.scoring.textmatch import MatchTerm
        return MatchTerm(phrase=phrase, mode="fuzzy")

    def test_empty_text_returns_no_matches(self):
        from yuu_clip.scoring.textmatch import find_fuzzy_matches
        assert find_fuzzy_matches("", [self._term("John")]) == []

    def test_near_miss_spelling_matches(self):
        from yuu_clip.scoring.textmatch import find_fuzzy_matches
        matches = find_fuzzy_matches("my name is Jonh, nice to meet you", [self._term("John")])
        assert len(matches) == 1
        assert matches[0].matched_text == "Jonh"
        assert matches[0].count == 1

    def test_near_miss_spelling_matches_transposed_letters(self):
        from yuu_clip.scoring.textmatch import find_fuzzy_matches
        matches = find_fuzzy_matches("please call Micheal about the trip", [self._term("Michael")])
        assert len(matches) == 1
        assert matches[0].matched_text == "Micheal"

    def test_unrelated_word_is_rejected_by_threshold(self):
        from yuu_clip.scoring.textmatch import find_fuzzy_matches
        assert find_fuzzy_matches("nothing relevant here at all", [self._term("John")]) == []

    def test_terms_shorter_than_min_length_are_skipped(self):
        from yuu_clip.scoring.textmatch import FUZZY_MIN_TERM_LENGTH, find_fuzzy_matches
        assert len("Amy") < FUZZY_MIN_TERM_LENGTH
        assert find_fuzzy_matches("call Amy now", [self._term("Amy")]) == []

    def test_multi_word_term_matches_across_the_full_phrase(self):
        from yuu_clip.scoring.textmatch import find_fuzzy_matches
        matches = find_fuzzy_matches(
            "he said 42 wallaby way is the address", [self._term("42 Wallaby Way")],
        )
        assert len(matches) == 1
        assert matches[0].matched_text == "42 wallaby way"

    def test_multi_word_term_near_miss_still_matches(self):
        from yuu_clip.scoring.textmatch import find_fuzzy_matches
        matches = find_fuzzy_matches(
            "he lives at 42 wallaby wai in the story", [self._term("42 Wallaby Way")],
        )
        assert len(matches) == 1

    def test_overlapping_windows_do_not_double_count_one_occurrence(self):
        # Regression guard: "wallaby way is" also scores above threshold right next
        # to the true "42 wallaby way" hit - the non-overlapping scan must not
        # count both.
        from yuu_clip.scoring.textmatch import find_fuzzy_matches
        matches = find_fuzzy_matches(
            "he said 42 wallaby way is the address", [self._term("42 Wallaby Way")],
        )
        assert matches[0].count == 1

    def test_two_separate_occurrences_are_both_counted(self):
        from yuu_clip.scoring.textmatch import find_fuzzy_matches
        matches = find_fuzzy_matches("Jonh was here, then Jonh left", [self._term("John")])
        assert matches[0].count == 2


# ---------------------------------------------------------------------------
# apply_sensitive_scan
# ---------------------------------------------------------------------------

class TestApplySensitiveScan:
    def _clip(self, excerpt="", description="", description_long="",
              score_funny=0.4, score_dramatic=0.4, score_action=0.4, score_overall=0.4):
        from yuu_clip.db.models import ClipCandidate
        return ClipCandidate(
            video_id=1, start_ms=0, end_ms=1000,
            transcript_excerpt=excerpt, description=description, description_long=description_long,
            score_funny=score_funny, score_dramatic=score_dramatic,
            score_action=score_action, score_overall=score_overall,
        )

    def _term(self, term, category="privacy", mode="exact", enabled=True):
        from yuu_clip.db.models import SensitiveTerm
        return SensitiveTerm(term=term, category=category, match_mode=mode, enabled=enabled)

    def test_excerpt_match_is_recorded(self):
        from yuu_clip.scoring.engine import apply_sensitive_scan
        clip = self._clip(excerpt="John walked into the room")
        apply_sensitive_scan(clip, [self._term("John")])
        assert clip.sensitive_matches == [
            {"term": "John", "category": "privacy", "mode": "exact", "matched_text": "John", "count": 1},
        ]

    def test_description_only_match_still_flags(self):
        from yuu_clip.scoring.engine import apply_sensitive_scan
        clip = self._clip(excerpt="nothing relevant", description="John's front porch")
        apply_sensitive_scan(clip, [self._term("John")])
        assert len(clip.sensitive_matches) == 1
        assert clip.sensitive_matches[0]["term"] == "John"

    def test_description_long_only_match_still_flags(self):
        from yuu_clip.scoring.engine import apply_sensitive_scan
        clip = self._clip(excerpt="", description_long="They visited John at home")
        apply_sensitive_scan(clip, [self._term("John")])
        assert len(clip.sensitive_matches) == 1

    def test_fuzzy_match_records_matched_text(self):
        from yuu_clip.scoring.engine import apply_sensitive_scan
        clip = self._clip(excerpt="my name is Jonh, nice to meet you")
        apply_sensitive_scan(clip, [self._term("John", mode="fuzzy")])
        assert clip.sensitive_matches == [
            {"term": "John", "category": "privacy", "mode": "fuzzy", "matched_text": "Jonh", "count": 1},
        ]

    def test_censor_category_is_preserved(self):
        from yuu_clip.scoring.engine import apply_sensitive_scan
        clip = self._clip(excerpt="that word should be bleeped")
        apply_sensitive_scan(clip, [self._term("bleeped", category="censor")])
        assert clip.sensitive_matches[0]["category"] == "censor"

    def test_disabled_term_is_ignored(self):
        from yuu_clip.scoring.engine import apply_sensitive_scan
        clip = self._clip(excerpt="John walked into the room")
        apply_sensitive_scan(clip, [self._term("John", enabled=False)])
        assert clip.sensitive_matches == []

    def test_no_match_returns_empty_list(self):
        from yuu_clip.scoring.engine import apply_sensitive_scan
        clip = self._clip(excerpt="nothing relevant here")
        apply_sensitive_scan(clip, [self._term("John")])
        assert clip.sensitive_matches == []

    def test_empty_term_list_is_a_no_op(self):
        from yuu_clip.scoring.engine import apply_sensitive_scan
        clip = self._clip(excerpt="John walked into the room")
        apply_sensitive_scan(clip, [])
        assert clip.sensitive_matches == []

    def test_rescan_after_term_disabled_clears_the_flag(self):
        from yuu_clip.scoring.engine import apply_sensitive_scan
        clip = self._clip(excerpt="John walked into the room")
        term = self._term("John")
        apply_sensitive_scan(clip, [term])
        assert clip.sensitive_matches != []
        term.enabled = False
        apply_sensitive_scan(clip, [term])
        assert clip.sensitive_matches == []

    def test_speaker_prefix_is_stripped_before_matching(self):
        # A named Speaker equal to a Privacy Term would otherwise match on every
        # line they speak - the same reason hot-words strips prefixes first.
        from yuu_clip.scoring.engine import apply_sensitive_scan
        clip = self._clip(excerpt="John: watch out for the rocket")
        apply_sensitive_scan(clip, [self._term("John")])
        assert clip.sensitive_matches == []

    def test_case_insensitive_mode_folds_unicode_accents(self):
        from yuu_clip.scoring.engine import apply_sensitive_scan
        clip = self._clip(excerpt="I love CAFÉ today")
        apply_sensitive_scan(clip, [self._term("café", mode="case_insensitive")])
        assert len(clip.sensitive_matches) == 1

    def test_multi_word_term_does_not_spuriously_match_across_field_boundary(self):
        # excerpt ends with the term's first word, description starts with its
        # second word - scanning fields separately (not concatenated) must not
        # let these join into a false multi-word match.
        from yuu_clip.scoring.engine import apply_sensitive_scan
        clip = self._clip(excerpt="he lives at 42", description="Wallaby Way is quiet")
        apply_sensitive_scan(clip, [self._term("42 Wallaby Way")])
        assert clip.sensitive_matches == []

    def test_never_touches_score_fields(self):
        from yuu_clip.scoring.engine import apply_sensitive_scan
        clip = self._clip(
            excerpt="John walked into the room",
            score_funny=0.4, score_dramatic=0.5, score_action=0.6, score_overall=0.55,
        )
        apply_sensitive_scan(clip, [self._term("John")])
        assert clip.score_funny == 0.4
        assert clip.score_dramatic == 0.5
        assert clip.score_action == 0.6
        assert clip.score_overall == 0.55


# ---------------------------------------------------------------------------
# ScoringEngine integration - no score impact, hot-word independence
# ---------------------------------------------------------------------------

class TestScoringEngineSensitiveIntegration:
    def _make_scorer(self, score_funny=0.3, score_dramatic=0.3, score_action=0.3):
        from unittest.mock import MagicMock

        from yuu_clip.scoring.protocol import ScoreResult
        mock = MagicMock()
        mock.is_available.return_value = True
        mock.weight = 1.0
        mock.score.return_value = ScoreResult(
            score_funny=score_funny, score_dramatic=score_dramatic, score_action=score_action,
        )
        return mock

    def test_score_clip_flags_without_changing_scores_when_opted_in(self):
        from yuu_clip.config import Config
        from yuu_clip.db.models import ClipCandidate, SensitiveTerm
        from yuu_clip.scoring.engine import ScoringEngine
        clip = ClipCandidate(video_id=1, start_ms=0, end_ms=1000, transcript_excerpt="John was here")
        term = SensitiveTerm(term="John", category="privacy", match_mode="exact", enabled=True)
        engine = ScoringEngine(Config(), [self._make_scorer(score_funny=0.3)], sensitive_terms=[term])
        engine.score_clip(clip, None)
        assert clip.score_funny == 0.3
        assert len(clip.sensitive_matches) == 1

    def test_score_clip_skips_sensitive_scan_when_not_opted_in(self):
        from yuu_clip.config import Config
        from yuu_clip.db.models import ClipCandidate
        from yuu_clip.scoring.engine import ScoringEngine
        clip = ClipCandidate(video_id=1, start_ms=0, end_ms=1000, transcript_excerpt="John was here")
        engine = ScoringEngine(Config(), [self._make_scorer(score_funny=0.3)])
        engine.score_clip(clip, None)
        assert clip.sensitive_matches_json is None

    def test_score_byte_identical_with_and_without_sensitive_terms(self):
        from yuu_clip.config import Config
        from yuu_clip.db.models import ClipCandidate, SensitiveTerm
        from yuu_clip.scoring.engine import ScoringEngine

        clip_without = ClipCandidate(video_id=1, start_ms=0, end_ms=1000, transcript_excerpt="John was here")
        ScoringEngine(Config(), [self._make_scorer(score_funny=0.3, score_dramatic=0.4, score_action=0.5)]).score_clip(clip_without, None)

        clip_with = ClipCandidate(video_id=1, start_ms=0, end_ms=1000, transcript_excerpt="John was here")
        term = SensitiveTerm(term="John", category="privacy", match_mode="exact", enabled=True)
        ScoringEngine(
            Config(), [self._make_scorer(score_funny=0.3, score_dramatic=0.4, score_action=0.5)],
            sensitive_terms=[term],
        ).score_clip(clip_with, None)

        assert clip_with.score_funny == clip_without.score_funny
        assert clip_with.score_dramatic == clip_without.score_dramatic
        assert clip_with.score_action == clip_without.score_action
        assert clip_with.score_overall == clip_without.score_overall

    def test_hotword_and_sensitive_term_on_the_same_phrase_both_fire_independently(self):
        from yuu_clip.config import Config
        from yuu_clip.db.models import ClipCandidate, HotWord, SensitiveTerm
        from yuu_clip.scoring.engine import ScoringEngine
        # A pre-set description keeps the non-LLM basic-description fallback (Stage 02)
        # out of this test - otherwise the template one-liner would echo "haha" from the
        # excerpt and the censor term would legitimately match it too (count 2).
        clip = ClipCandidate(
            video_id=1, start_ms=0, end_ms=1000,
            transcript_excerpt="haha wow", description="a funny clip",
        )
        hot_word = HotWord(phrase="haha", match_mode="exact", boost=0.2, target="funny", enabled=True)
        sensitive_term = SensitiveTerm(term="haha", category="censor", match_mode="exact", enabled=True)
        engine = ScoringEngine(
            Config(), [self._make_scorer(score_funny=0.3)],
            hot_words=[hot_word], sensitive_terms=[sensitive_term],
        )
        engine.score_clip(clip, None)
        assert abs(clip.score_funny - 0.5) < 1e-6
        assert clip.hotword_matches == [{"phrase": "haha", "mode": "exact", "count": 1}]
        assert clip.sensitive_matches == [
            {"term": "haha", "category": "censor", "mode": "exact", "matched_text": "haha", "count": 1},
        ]
