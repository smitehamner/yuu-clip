"""Sensitive content detection (roadmap plan 06) — fuzzy matcher, apply_sensitive_scan,
ScoringEngine integration, and CRUD/rescan routes.

Term values are user PII by definition, so a dedicated logging-safety test captures
caplog around every route that touches a term value and asserts it never appears in
the log output (mirrors the "never log term values" rule in routes/sensitive.py and
SensitiveTerm's docstring).
"""
from __future__ import annotations

import logging

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
        # to the true "42 wallaby way" hit — the non-overlapping scan must not
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
        # line they speak — the same reason hot-words strips prefixes first.
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
        # second word — scanning fields separately (not concatenated) must not
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
# ScoringEngine integration — no score impact, hot-word independence
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
        # out of this test — otherwise the template one-liner would echo "haha" from the
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


# ---------------------------------------------------------------------------
# CRUD routes
# ---------------------------------------------------------------------------

class TestSensitiveTermCrudRoutes:
    def test_list_empty_by_default(self, client):
        r = client.get("/api/sensitive-terms")
        assert r.status_code == 200
        assert r.json() == []

    def test_create_returns_term(self, client):
        r = client.post("/api/sensitive-terms", json={
            "term": "John", "category": "privacy", "match_mode": "exact", "enabled": True,
        })
        assert r.status_code == 200
        body = r.json()
        assert body["term"] == "John"
        assert body["id"] is not None
        assert "clips_scanned" in body
        assert "clips_flagged" in body

    def test_created_term_is_listed(self, client):
        client.post("/api/sensitive-terms", json={
            "term": "John", "category": "privacy", "match_mode": "exact", "enabled": True,
        })
        r = client.get("/api/sensitive-terms")
        assert len(r.json()) == 1

    def test_create_rejects_empty_term(self, client):
        r = client.post("/api/sensitive-terms", json={
            "term": "  ", "category": "privacy", "match_mode": "exact", "enabled": True,
        })
        assert r.status_code == 400

    def test_create_rejects_overlong_term(self, client):
        r = client.post("/api/sensitive-terms", json={
            "term": "x" * 201, "category": "privacy", "match_mode": "exact", "enabled": True,
        })
        assert r.status_code == 400

    def test_create_rejects_invalid_category(self, client):
        r = client.post("/api/sensitive-terms", json={
            "term": "John", "category": "nonexistent", "match_mode": "exact", "enabled": True,
        })
        assert r.status_code == 400

    def test_create_rejects_invalid_match_mode(self, client):
        r = client.post("/api/sensitive-terms", json={
            "term": "John", "category": "privacy", "match_mode": "semantic", "enabled": True,
        })
        assert r.status_code == 400

    def test_create_rejects_fuzzy_mode_below_min_length(self, client):
        r = client.post("/api/sensitive-terms", json={
            "term": "Amy", "category": "privacy", "match_mode": "fuzzy", "enabled": True,
        })
        assert r.status_code == 400
        assert "4 characters" in r.json()["detail"]

    def test_create_allows_fuzzy_mode_at_min_length(self, client):
        r = client.post("/api/sensitive-terms", json={
            "term": "Amyy", "category": "privacy", "match_mode": "fuzzy", "enabled": True,
        })
        assert r.status_code == 200

    def test_update_existing_term(self, client):
        created = client.post("/api/sensitive-terms", json={
            "term": "John", "category": "privacy", "match_mode": "exact", "enabled": True,
        }).json()
        r = client.put(f"/api/sensitive-terms/{created['id']}", json={
            "term": "John", "category": "censor", "match_mode": "case_insensitive", "enabled": False,
        })
        assert r.status_code == 200
        assert r.json()["category"] == "censor"
        assert r.json()["match_mode"] == "case_insensitive"
        assert r.json()["enabled"] is False

    def test_update_missing_term_404(self, client):
        r = client.put("/api/sensitive-terms/99999", json={
            "term": "John", "category": "privacy", "match_mode": "exact", "enabled": True,
        })
        assert r.status_code == 404

    def test_delete_existing_term(self, client):
        created = client.post("/api/sensitive-terms", json={
            "term": "John", "category": "privacy", "match_mode": "exact", "enabled": True,
        }).json()
        r = client.delete(f"/api/sensitive-terms/{created['id']}")
        assert r.status_code == 200
        assert client.get("/api/sensitive-terms").json() == []

    def test_delete_missing_term_404(self, client):
        r = client.delete("/api/sensitive-terms/99999")
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# Term-list save triggers a project-wide rescan
# ---------------------------------------------------------------------------

class TestSensitiveTermSaveTriggersRescan:
    def _seed_clip_excerpt(self, client, excerpt):
        vid_id = client.get("/api/videos").json()[0]["id"]
        clips = client.get(f"/api/videos/{vid_id}/clips").json()
        clip_id = clips[0]["id"]
        from yuu_clip.db.models import ClipCandidate, make_session
        db = make_session(client.app.state.ctx.db_path)
        clip = db.get(ClipCandidate, clip_id)
        clip.transcript_excerpt = excerpt
        db.commit()
        db.close()
        return clip_id

    def test_create_flags_a_matching_clip_immediately(self, client):
        clip_id = self._seed_clip_excerpt(client, "John walked into the room")
        r = client.post("/api/sensitive-terms", json={
            "term": "John", "category": "privacy", "match_mode": "exact", "enabled": True,
        })
        assert r.json()["clips_flagged"] == 1
        assert r.json()["clips_scanned"] >= 1

        from yuu_clip.db.models import ClipCandidate, make_session
        db = make_session(client.app.state.ctx.db_path)
        clip = db.get(ClipCandidate, clip_id)
        matches = clip.sensitive_matches
        db.close()
        assert len(matches) == 1

    def test_delete_clears_the_flag_immediately(self, client):
        clip_id = self._seed_clip_excerpt(client, "John walked into the room")
        created = client.post("/api/sensitive-terms", json={
            "term": "John", "category": "privacy", "match_mode": "exact", "enabled": True,
        }).json()
        r = client.delete(f"/api/sensitive-terms/{created['id']}")
        assert r.json()["clips_flagged"] == 0

        from yuu_clip.db.models import ClipCandidate, make_session
        db = make_session(client.app.state.ctx.db_path)
        clip = db.get(ClipCandidate, clip_id)
        matches = clip.sensitive_matches
        db.close()
        assert matches == []

    def test_disabling_via_update_clears_the_flag(self, client):
        self._seed_clip_excerpt(client, "John walked into the room")
        created = client.post("/api/sensitive-terms", json={
            "term": "John", "category": "privacy", "match_mode": "exact", "enabled": True,
        }).json()
        r = client.put(f"/api/sensitive-terms/{created['id']}", json={
            "term": "John", "category": "privacy", "match_mode": "exact", "enabled": False,
        })
        assert r.json()["clips_flagged"] == 0


# ---------------------------------------------------------------------------
# sensitive-rescan route (manual, per-video)
# ---------------------------------------------------------------------------

class TestSensitiveRescanRoute:
    def _vid_id(self, client):
        return client.get("/api/videos").json()[0]["id"]

    def test_rescan_missing_video_404(self, client):
        r = client.post("/api/videos/99999/sensitive-rescan")
        assert r.status_code == 404

    def test_rescan_is_a_no_op_with_no_terms_configured(self, client):
        vid_id = self._vid_id(client)
        r = client.post(f"/api/videos/{vid_id}/sensitive-rescan")
        assert r.status_code == 200
        assert r.json()["clips_changed"] == 0

    def test_rescan_reports_checked_and_changed_counts(self, client):
        # Term-list saves already trigger their own project-wide rescan (see
        # TestSensitiveTermSaveTriggersRescan) — this route is for the other
        # trigger: a clip's transcript changing *after* the term list was last
        # saved (e.g. a caption edit or re-transcribe), with no term-list write
        # to piggyback on.
        vid_id = self._vid_id(client)
        clips = client.get(f"/api/videos/{vid_id}/clips").json()
        target_clip_id = clips[0]["id"]

        client.post("/api/sensitive-terms", json={
            "term": "John", "category": "privacy", "match_mode": "exact", "enabled": True,
        })

        from yuu_clip.db.models import ClipCandidate, make_session
        db = make_session(client.app.state.ctx.db_path)
        clip = db.get(ClipCandidate, target_clip_id)
        clip.transcript_excerpt = "John was here"
        db.commit()
        db.close()

        r = client.post(f"/api/videos/{vid_id}/sensitive-rescan")
        assert r.status_code == 200
        body = r.json()
        assert body["clips_checked"] == len(clips)
        assert body["clips_changed"] == 1


# ---------------------------------------------------------------------------
# Logging safety — term values must never appear in logs
# ---------------------------------------------------------------------------

class TestSensitiveTermValuesNeverLogged:
    _SECRET_TERM = "SuperSecretPersonName12345"

    def test_crud_and_rescan_never_log_the_term_value(self, client, caplog):
        caplog.set_level(logging.DEBUG)

        vid_id = client.get("/api/videos").json()[0]["id"]
        clips = client.get(f"/api/videos/{vid_id}/clips").json()
        clip_id = clips[0]["id"]
        from yuu_clip.db.models import ClipCandidate, make_session
        db = make_session(client.app.state.ctx.db_path)
        clip = db.get(ClipCandidate, clip_id)
        clip.transcript_excerpt = f"{self._SECRET_TERM} was mentioned here"
        db.commit()
        db.close()

        created = client.post("/api/sensitive-terms", json={
            "term": self._SECRET_TERM, "category": "privacy", "match_mode": "exact", "enabled": True,
        }).json()
        client.put(f"/api/sensitive-terms/{created['id']}", json={
            "term": self._SECRET_TERM, "category": "censor", "match_mode": "exact", "enabled": True,
        })
        client.post(f"/api/videos/{vid_id}/sensitive-rescan")
        client.delete(f"/api/sensitive-terms/{created['id']}")

        assert self._SECRET_TERM not in caplog.text
