"""Hot-word / phrase config (roadmap plan 03) - matcher, boost application, CRUD."""
from __future__ import annotations

# ---------------------------------------------------------------------------
# textmatch.find_matches / strip_speaker_prefixes
# ---------------------------------------------------------------------------

class TestFindMatches:
    def _term(self, phrase, mode="exact"):
        from yuu_clip.scoring.textmatch import MatchTerm
        return MatchTerm(phrase=phrase, mode=mode)

    def test_empty_text_returns_no_matches(self):
        from yuu_clip.scoring.textmatch import find_matches
        assert find_matches("", [self._term("fire")]) == []

    def test_word_boundary_excludes_substring(self):
        from yuu_clip.scoring.textmatch import find_matches
        assert find_matches("we start now", [self._term("art")]) == []

    def test_word_boundary_matches_whole_word(self):
        from yuu_clip.scoring.textmatch import find_matches
        matches = find_matches("nice art here", [self._term("art")])
        assert len(matches) == 1
        assert matches[0].count == 1

    def test_case_insensitive_mode_folds_case(self):
        from yuu_clip.scoring.textmatch import find_matches
        matches = find_matches("HELLO there", [self._term("hello", "case_insensitive")])
        assert len(matches) == 1

    def test_exact_mode_is_case_sensitive(self):
        from yuu_clip.scoring.textmatch import find_matches
        assert find_matches("HELLO there", [self._term("hello", "exact")]) == []

    def test_multi_word_phrase_matches_across_punctuation_gap(self):
        from yuu_clip.scoring.textmatch import find_matches
        matches = find_matches("he said oh, no way", [self._term("oh no")])
        assert len(matches) == 1

    def test_phrase_at_string_start(self):
        from yuu_clip.scoring.textmatch import find_matches
        assert len(find_matches("fire! watch out", [self._term("fire")])) == 1

    def test_phrase_at_string_end(self):
        from yuu_clip.scoring.textmatch import find_matches
        assert len(find_matches("watch out for the fire", [self._term("fire")])) == 1

    def test_regex_metacharacters_are_escaped(self):
        from yuu_clip.scoring.textmatch import find_matches
        matches = find_matches("I love c++ programming", [self._term("c++")])
        assert len(matches) == 1

    def test_repeat_count_recorded_but_counted_once(self):
        from yuu_clip.scoring.textmatch import find_matches
        matches = find_matches("haha that is haha funny haha", [self._term("haha")])
        assert len(matches) == 1
        assert matches[0].count == 3

    def test_no_match_returns_empty_list(self):
        from yuu_clip.scoring.textmatch import find_matches
        assert find_matches("nothing relevant here", [self._term("fire")]) == []


class TestStripSpeakerPrefixes:
    def test_strips_leading_name_prefix_per_line(self):
        from yuu_clip.scoring.textmatch import strip_speaker_prefixes
        text = "Fire: watch out\nAlex: nice shot"
        stripped = strip_speaker_prefixes(text)
        assert "Fire:" not in stripped
        assert "watch out" in stripped
        assert "nice shot" in stripped

    def test_speaker_name_does_not_spuriously_match_after_stripping(self):
        from yuu_clip.scoring.textmatch import MatchTerm, find_matches, strip_speaker_prefixes
        text = "Fire: watch out for the rocket"
        stripped = strip_speaker_prefixes(text)
        assert find_matches(stripped, [MatchTerm(phrase="fire", mode="case_insensitive")]) == []


# ---------------------------------------------------------------------------
# apply_hotword_boosts
# ---------------------------------------------------------------------------

class TestApplyHotwordBoosts:
    def _clip(self, text="", score_funny=0.3, score_dramatic=0.3, score_action=0.3, score_overall=0.3):
        from yuu_clip.db.models import ClipCandidate
        clip = ClipCandidate(
            video_id=1, start_ms=0, end_ms=1000,
            transcript_excerpt=text,
            score_funny=score_funny, score_dramatic=score_dramatic,
            score_action=score_action, score_overall=score_overall,
        )
        return clip

    def _hotword(self, phrase, boost, target="funny", mode="exact", enabled=True):
        from yuu_clip.db.models import HotWord
        return HotWord(phrase=phrase, match_mode=mode, boost=boost, target=target, enabled=enabled)

    def test_phrase_counted_once_per_clip_regardless_of_repeats(self):
        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import apply_hotword_boosts
        clip = self._clip(text="haha wow haha so haha funny", score_funny=0.3)
        hw = self._hotword("haha", boost=0.2, target="funny")
        apply_hotword_boosts(clip, [hw], Config())
        assert abs(clip.score_funny - 0.5) < 1e-6
        assert clip.hotword_matches[0]["count"] == 3

    def test_multiple_phrases_stack_and_clamp_per_target(self):
        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import apply_hotword_boosts
        clip = self._clip(text="haha wow", score_funny=0.3)
        hw1 = self._hotword("haha", boost=0.3, target="funny")
        hw2 = self._hotword("wow", boost=0.25, target="funny")
        apply_hotword_boosts(clip, [hw1, hw2], Config())
        # 0.3 + 0.25 = 0.55, clamped to the +-0.3 per-target cap before being applied
        assert abs(clip.score_funny - 0.6) < 1e-6

    def test_final_score_clamped_to_one(self):
        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import apply_hotword_boosts
        clip = self._clip(text="haha", score_funny=0.9)
        hw = self._hotword("haha", boost=0.3, target="funny")
        apply_hotword_boosts(clip, [hw], Config())
        assert clip.score_funny == 1.0

    def test_final_score_clamped_to_zero(self):
        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import apply_hotword_boosts
        clip = self._clip(text="ugh", score_funny=0.1)
        hw = self._hotword("ugh", boost=-0.3, target="funny")
        apply_hotword_boosts(clip, [hw], Config())
        assert clip.score_funny == 0.0

    def test_sub_score_boost_flows_into_overall_via_recompute(self):
        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import apply_hotword_boosts
        clip = self._clip(text="haha", score_funny=0.3, score_dramatic=0.3, score_action=0.3, score_overall=0.3)
        hw = self._hotword("haha", boost=0.3, target="funny")
        apply_hotword_boosts(clip, [hw], Config())
        # funny -> 0.6; overall = (0.6+0.3+0.3+0)/3.5 (Visual axis weight 0.5, score 0)
        assert abs(clip.score_overall - (1.2 / 3.5)) < 1e-6

    def test_overall_target_boost_applied_on_top_of_recompute(self):
        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import apply_hotword_boosts
        clip = self._clip(text="jackpot", score_funny=0.3, score_dramatic=0.3, score_action=0.3, score_overall=0.3)
        hw = self._hotword("jackpot", boost=0.1, target="overall")
        apply_hotword_boosts(clip, [hw], Config())
        assert abs(clip.score_overall - 0.4) < 1e-6

    def test_user_override_never_touched(self):
        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import apply_hotword_boosts
        clip = self._clip(text="haha", score_funny=0.3)
        clip.score_overall_user = 0.9
        hw = self._hotword("haha", boost=0.3, target="funny")
        apply_hotword_boosts(clip, [hw], Config())
        assert clip.score_overall_user == 0.9

    def test_disabled_hotword_is_ignored(self):
        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import apply_hotword_boosts
        clip = self._clip(text="haha", score_funny=0.3)
        hw = self._hotword("haha", boost=0.3, target="funny", enabled=False)
        apply_hotword_boosts(clip, [hw], Config())
        assert abs(clip.score_funny - 0.3) < 1e-6

    def test_no_transcript_produces_no_matches_and_no_crash(self):
        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import apply_hotword_boosts
        clip = self._clip(text=None, score_funny=0.3)
        hw = self._hotword("haha", boost=0.3, target="funny")
        apply_hotword_boosts(clip, [hw], Config())
        assert clip.hotword_matches == []
        assert abs(clip.score_funny - 0.3) < 1e-6

    def test_rescan_is_idempotent(self):
        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import apply_hotword_boosts
        clip = self._clip(text="haha wow", score_funny=0.3)
        hw = self._hotword("haha", boost=0.2, target="funny")
        apply_hotword_boosts(clip, [hw], Config())
        first_pass = clip.score_funny
        apply_hotword_boosts(clip, [hw], Config())
        assert clip.score_funny == first_pass

    def test_boost_removed_when_term_deleted_then_rescanned(self):
        from yuu_clip.config import Config
        from yuu_clip.scoring.engine import apply_hotword_boosts
        clip = self._clip(text="haha wow", score_funny=0.3)
        hw = self._hotword("haha", boost=0.2, target="funny")
        apply_hotword_boosts(clip, [hw], Config())
        assert abs(clip.score_funny - 0.5) < 1e-6
        apply_hotword_boosts(clip, [], Config())  # term deleted - none passed in on rescan
        assert abs(clip.score_funny - 0.3) < 1e-6
        assert clip.hotword_matches == []


# ---------------------------------------------------------------------------
# ScoringEngine integration
# ---------------------------------------------------------------------------

class TestScoringEngineHotwordIntegration:
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

    def test_score_clip_applies_hotword_boost_when_opted_in(self):
        from yuu_clip.config import Config
        from yuu_clip.db.models import ClipCandidate, HotWord
        from yuu_clip.scoring.engine import ScoringEngine
        clip = ClipCandidate(video_id=1, start_ms=0, end_ms=1000, transcript_excerpt="haha wow")
        hw = HotWord(phrase="haha", match_mode="exact", boost=0.2, target="funny", enabled=True)
        engine = ScoringEngine(Config(), [self._make_scorer(score_funny=0.3)], hot_words=[hw])
        engine.score_clip(clip, None)
        assert abs(clip.score_funny - 0.5) < 1e-6

    def test_score_clip_hotword_boost_does_not_compound_on_rescore(self):
        # Scoring the same clip twice must land the same boosted score - _reset_scores
        # rewrites the dimension scores fresh (no boost baked in), so the second run
        # must not subtract the prior run's stale boost and cancel the new one out.
        from yuu_clip.config import Config
        from yuu_clip.db.models import ClipCandidate, HotWord
        from yuu_clip.scoring.engine import ScoringEngine
        clip = ClipCandidate(video_id=1, start_ms=0, end_ms=1000, transcript_excerpt="haha wow")
        hw = HotWord(phrase="haha", match_mode="exact", boost=0.2, target="funny", enabled=True)
        engine = ScoringEngine(Config(), [self._make_scorer(score_funny=0.3)], hot_words=[hw])
        engine.score_clip(clip, None)
        assert abs(clip.score_funny - 0.5) < 1e-6
        engine.score_clip(clip, None)   # rescore
        assert abs(clip.score_funny - 0.5) < 1e-6   # not 0.3 (boost dropped) or 0.7 (doubled)

    def test_score_clip_filters_hotwords_by_video_context(self):
        # score_clip resolves the clip's video and drops hot-words scoped to a
        # context the recording is not tagged with - the ingest/rescore path.
        from yuu_clip.config import Config
        from yuu_clip.db.models import ClipCandidate, HotWord, Video
        from yuu_clip.scoring.engine import ScoringEngine
        clip = ClipCandidate(video_id=1, start_ms=0, end_ms=1000, transcript_excerpt="haha wow")
        clip.video = Video(path="x", filename="x", context_names_json='["fantasy-rp"]')
        hw_global = HotWord(phrase="haha", match_mode="exact", boost=0.2, target="funny", enabled=True)
        hw_shooter = HotWord(
            phrase="wow", match_mode="exact", boost=0.3, target="funny",
            enabled=True, context_slug="multiplayer-shooter",
        )
        engine = ScoringEngine(Config(), [self._make_scorer(score_funny=0.3)], hot_words=[hw_global, hw_shooter])
        engine.score_clip(clip, None)
        assert abs(clip.score_funny - 0.5) < 1e-6  # only the global "haha" fired
        assert [m["phrase"] for m in clip.hotword_matches] == ["haha"]

    def test_score_clip_applies_matching_context_hotword(self):
        from yuu_clip.config import Config
        from yuu_clip.db.models import ClipCandidate, HotWord, Video
        from yuu_clip.scoring.engine import ScoringEngine
        clip = ClipCandidate(video_id=1, start_ms=0, end_ms=1000, transcript_excerpt="wow nice")
        clip.video = Video(path="x", filename="x", context_names_json='["multiplayer-shooter"]')
        hw = HotWord(
            phrase="wow", match_mode="exact", boost=0.3, target="funny",
            enabled=True, context_slug="multiplayer-shooter",
        )
        engine = ScoringEngine(Config(), [self._make_scorer(score_funny=0.3)], hot_words=[hw])
        engine.score_clip(clip, None)
        assert abs(clip.score_funny - 0.6) < 1e-6

    def test_score_clip_skips_hotwords_when_not_opted_in(self):
        # hot_words=None (default) - engine must not touch hotword_matches/boost at all,
        # so callers that don't care about the feature see zero behavior change.
        from yuu_clip.config import Config
        from yuu_clip.db.models import ClipCandidate
        from yuu_clip.scoring.engine import ScoringEngine
        clip = ClipCandidate(video_id=1, start_ms=0, end_ms=1000, transcript_excerpt="haha wow")
        engine = ScoringEngine(Config(), [self._make_scorer(score_funny=0.3)])
        engine.score_clip(clip, None)
        assert abs(clip.score_funny - 0.3) < 1e-6
        assert clip.hotword_matches_json is None


# ---------------------------------------------------------------------------
# CRUD routes
# ---------------------------------------------------------------------------

class TestHotwordCrudRoutes:
    def test_list_empty_by_default(self, client):
        r = client.get("/api/hotwords")
        assert r.status_code == 200
        assert r.json() == []

    def test_create_returns_hotword(self, client):
        r = client.post("/api/hotwords", json={
            "phrase": "haha", "match_mode": "exact", "boost": 0.2, "target": "funny", "enabled": True,
        })
        assert r.status_code == 200
        body = r.json()
        assert body["phrase"] == "haha"
        assert body["id"] is not None

    def test_created_hotword_is_listed(self, client):
        client.post("/api/hotwords", json={
            "phrase": "haha", "match_mode": "exact", "boost": 0.2, "target": "funny", "enabled": True,
        })
        r = client.get("/api/hotwords")
        assert len(r.json()) == 1

    def test_create_rejects_empty_phrase(self, client):
        r = client.post("/api/hotwords", json={
            "phrase": "  ", "match_mode": "exact", "boost": 0.1, "target": "funny", "enabled": True,
        })
        assert r.status_code == 400

    def test_create_rejects_overlong_phrase(self, client):
        r = client.post("/api/hotwords", json={
            "phrase": "x" * 201, "match_mode": "exact", "boost": 0.1, "target": "funny", "enabled": True,
        })
        assert r.status_code == 400

    def test_create_rejects_invalid_match_mode(self, client):
        r = client.post("/api/hotwords", json={
            "phrase": "haha", "match_mode": "fuzzy", "boost": 0.1, "target": "funny", "enabled": True,
        })
        assert r.status_code == 400

    def test_create_rejects_invalid_target(self, client):
        r = client.post("/api/hotwords", json={
            "phrase": "haha", "match_mode": "exact", "boost": 0.1, "target": "nonexistent", "enabled": True,
        })
        assert r.status_code == 400

    def test_create_rejects_boost_out_of_range(self, client):
        r = client.post("/api/hotwords", json={
            "phrase": "haha", "match_mode": "exact", "boost": 5.0, "target": "funny", "enabled": True,
        })
        assert r.status_code == 400

    def test_create_rejects_duplicate_phrase_and_mode(self, client):
        client.post("/api/hotwords", json={
            "phrase": "haha", "match_mode": "exact", "boost": 0.1, "target": "funny", "enabled": True,
        })
        r = client.post("/api/hotwords", json={
            "phrase": "haha", "match_mode": "exact", "boost": 0.2, "target": "action", "enabled": True,
        })
        assert r.status_code == 400

    def test_same_phrase_different_mode_is_allowed(self, client):
        client.post("/api/hotwords", json={
            "phrase": "haha", "match_mode": "exact", "boost": 0.1, "target": "funny", "enabled": True,
        })
        r = client.post("/api/hotwords", json={
            "phrase": "haha", "match_mode": "case_insensitive", "boost": 0.1, "target": "funny", "enabled": True,
        })
        assert r.status_code == 200


# ---------------------------------------------------------------------------
# Stage 3 - context_slug on the CRUD surface
# ---------------------------------------------------------------------------

class TestHotwordContextSlugCrud:
    def test_create_defaults_to_global_null_slug(self, client):
        body = client.post("/api/hotwords", json={
            "phrase": "haha", "match_mode": "exact", "boost": 0.1, "target": "funny", "enabled": True,
        }).json()
        assert body["context_slug"] is None

    def test_create_with_known_context_slug(self, client):
        body = client.post("/api/hotwords", json={
            "phrase": "thornwood", "match_mode": "exact", "boost": 0.2, "target": "funny",
            "enabled": True, "context_slug": "fantasy-rp",
        }).json()
        assert body["context_slug"] == "fantasy-rp"

    def test_create_rejects_unknown_context_slug(self, client):
        r = client.post("/api/hotwords", json={
            "phrase": "haha", "match_mode": "exact", "boost": 0.1, "target": "funny",
            "enabled": True, "context_slug": "no-such-context",
        })
        assert r.status_code == 400

    def test_empty_string_slug_stored_as_global(self, client):
        body = client.post("/api/hotwords", json={
            "phrase": "haha", "match_mode": "exact", "boost": 0.1, "target": "funny",
            "enabled": True, "context_slug": "",
        }).json()
        assert body["context_slug"] is None

    def test_same_phrase_and_mode_global_and_context_both_allowed(self, client):
        client.post("/api/hotwords", json={
            "phrase": "ace", "match_mode": "exact", "boost": 0.1, "target": "funny", "enabled": True,
        })
        r = client.post("/api/hotwords", json={
            "phrase": "ace", "match_mode": "exact", "boost": 0.1, "target": "funny",
            "enabled": True, "context_slug": "multiplayer-shooter",
        })
        assert r.status_code == 200

    def test_duplicate_phrase_mode_and_slug_rejected(self, client):
        client.post("/api/hotwords", json={
            "phrase": "ace", "match_mode": "exact", "boost": 0.1, "target": "funny",
            "enabled": True, "context_slug": "multiplayer-shooter",
        })
        r = client.post("/api/hotwords", json={
            "phrase": "ace", "match_mode": "exact", "boost": 0.2, "target": "action",
            "enabled": True, "context_slug": "multiplayer-shooter",
        })
        assert r.status_code == 400

    def test_orphaned_term_can_still_be_edited(self, client):
        # Simulate a term whose context was deleted after creation, then edit an
        # unrelated field. Re-validating the (now unknown) slug must not 400.
        created = client.post("/api/hotwords", json={
            "phrase": "thornwood", "match_mode": "exact", "boost": 0.1, "target": "funny",
            "enabled": True, "context_slug": "fantasy-rp",
        }).json()
        from yuu_clip.db.models import HotWord, make_session
        db = make_session(client.app.state.ctx.db_path)
        db.get(HotWord, created["id"]).context_slug = "deleted-context"
        db.commit()
        db.close()
        r = client.put(f"/api/hotwords/{created['id']}", json={
            "phrase": "thornwood", "match_mode": "exact", "boost": 0.3, "target": "funny",
            "enabled": False, "context_slug": "deleted-context",
        })
        assert r.status_code == 200
        assert r.json()["boost"] == 0.3


# ---------------------------------------------------------------------------
# Stage 2 - context-scoped boost application (rescan route)
# ---------------------------------------------------------------------------

class TestHotwordContextScoping:
    def _seed_video_context(self, client, context_ids):
        from yuu_clip.db.models import ClipCandidate, Video, make_session
        vid_id = client.get("/api/videos").json()[0]["id"]
        db = make_session(client.app.state.ctx.db_path)
        video = db.get(Video, vid_id)
        import json as _json
        video.context_names_json = _json.dumps(context_ids)
        clip = db.query(ClipCandidate).filter_by(video_id=vid_id).first()
        clip.transcript_excerpt = "haha that was great"
        db.commit()
        db.close()
        return vid_id

    def test_context_hotword_applies_to_matching_recording(self, client):
        vid_id = self._seed_video_context(client, ["fantasy-rp"])
        client.post("/api/hotwords", json={
            "phrase": "haha", "match_mode": "exact", "boost": 0.2, "target": "funny",
            "enabled": True, "context_slug": "fantasy-rp",
        })
        r = client.post(f"/api/videos/{vid_id}/hotword-rescan")
        assert r.json()["clips_changed"] == 1

    def test_context_hotword_skipped_for_unmatched_recording(self, client):
        vid_id = self._seed_video_context(client, ["multiplayer-shooter"])
        client.post("/api/hotwords", json={
            "phrase": "haha", "match_mode": "exact", "boost": 0.2, "target": "funny",
            "enabled": True, "context_slug": "fantasy-rp",
        })
        r = client.post(f"/api/videos/{vid_id}/hotword-rescan")
        assert r.json()["clips_changed"] == 0

    def test_global_hotword_still_applies_to_context_tagged_recording(self, client):
        vid_id = self._seed_video_context(client, ["fantasy-rp"])
        client.post("/api/hotwords", json={
            "phrase": "haha", "match_mode": "exact", "boost": 0.2, "target": "funny", "enabled": True,
        })
        r = client.post(f"/api/videos/{vid_id}/hotword-rescan")
        assert r.json()["clips_changed"] == 1

    def test_update_existing_hotword(self, client):
        created = client.post("/api/hotwords", json={
            "phrase": "haha", "match_mode": "exact", "boost": 0.1, "target": "funny", "enabled": True,
        }).json()
        r = client.put(f"/api/hotwords/{created['id']}", json={
            "phrase": "haha", "match_mode": "exact", "boost": 0.3, "target": "action", "enabled": False,
        })
        assert r.status_code == 200
        assert r.json()["boost"] == 0.3
        assert r.json()["target"] == "action"
        assert r.json()["enabled"] is False

    def test_update_missing_hotword_404(self, client):
        r = client.put("/api/hotwords/99999", json={
            "phrase": "haha", "match_mode": "exact", "boost": 0.1, "target": "funny", "enabled": True,
        })
        assert r.status_code == 404

    def test_delete_existing_hotword(self, client):
        created = client.post("/api/hotwords", json={
            "phrase": "haha", "match_mode": "exact", "boost": 0.1, "target": "funny", "enabled": True,
        }).json()
        r = client.delete(f"/api/hotwords/{created['id']}")
        assert r.status_code == 200
        assert client.get("/api/hotwords").json() == []

    def test_delete_missing_hotword_404(self, client):
        r = client.delete("/api/hotwords/99999")
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# hotword-rescan route
# ---------------------------------------------------------------------------

class TestHotwordRescanRoute:
    def _vid_id(self, client):
        return client.get("/api/videos").json()[0]["id"]

    def test_rescan_missing_video_404(self, client):
        r = client.post("/api/videos/99999/hotword-rescan")
        assert r.status_code == 404

    def test_rescan_reports_checked_and_changed_counts(self, client):
        vid_id = self._vid_id(client)
        clips = client.get(f"/api/videos/{vid_id}/clips").json()
        # Give one clip a transcript excerpt containing a hot-word phrase.
        target_clip_id = clips[0]["id"]
        from yuu_clip.db.models import ClipCandidate, make_session
        db = make_session(client.app.state.ctx.db_path)
        clip = db.get(ClipCandidate, target_clip_id)
        clip.transcript_excerpt = "haha that was great"
        db.commit()
        db.close()

        client.post("/api/hotwords", json={
            "phrase": "haha", "match_mode": "exact", "boost": 0.2, "target": "funny", "enabled": True,
        })
        r = client.post(f"/api/videos/{vid_id}/hotword-rescan")
        assert r.status_code == 200
        body = r.json()
        assert body["clips_checked"] == len(clips)
        assert body["clips_changed"] == 1

    def test_rescan_is_a_no_op_with_no_hotwords_configured(self, client):
        vid_id = self._vid_id(client)
        r = client.post(f"/api/videos/{vid_id}/hotword-rescan")
        assert r.status_code == 200
        assert r.json()["clips_changed"] == 0


# ---------------------------------------------------------------------------
# Stage 2 - LLM-semantic matching
# ---------------------------------------------------------------------------

class TestSemanticExcludedFromTextMatching:
    def test_semantic_hotword_never_matched_by_text_matcher(self):
        # Even though the literal phrase appears in the transcript, a mode="semantic"
        # entry must only ever be matched via the Stage 2 scan, never the cheap
        # exact/case-insensitive text pass.
        from yuu_clip.config import Config
        from yuu_clip.db.models import ClipCandidate, HotWord
        from yuu_clip.scoring.engine import apply_hotword_boosts
        clip = ClipCandidate(
            video_id=1, start_ms=0, end_ms=1000, transcript_excerpt="big win today",
            score_funny=0.3, score_dramatic=0.3, score_action=0.3, score_overall=0.3,
        )
        hw = HotWord(phrase="big win", match_mode="semantic", boost=0.2, target="funny", enabled=True)
        apply_hotword_boosts(clip, [hw], Config())
        assert clip.hotword_matches == []
        assert abs(clip.score_funny - 0.3) < 1e-6


class TestScanHotwordsSemantic:
    def _cfg(self):
        from yuu_clip.config import Config
        return Config()

    def test_empty_phrases_returns_empty_list_without_calling_llm(self):
        import unittest.mock as mock

        from yuu_clip.scoring.llm import scan_hotwords_semantic
        with mock.patch("yuu_clip.scoring.llm._call_client") as call:
            result = scan_hotwords_semantic("some transcript", [], self._cfg())
        assert result == []
        call.assert_not_called()

    def test_prompt_includes_phrases_and_transcript(self):
        import json
        import unittest.mock as mock

        from yuu_clip.scoring.llm import scan_hotwords_semantic
        with mock.patch("yuu_clip.scoring.llm._call_client", return_value=json.dumps(["big win"])) as call:
            scan_hotwords_semantic("I won the jackpot!", ["big win", "sad moment"], self._cfg())
        messages = call.call_args[0][0]
        user_content = messages[-1]["content"]
        assert "big win" in user_content
        assert "sad moment" in user_content
        assert "I won the jackpot!" in user_content

    def test_returns_matched_phrases(self):
        import json
        import unittest.mock as mock

        from yuu_clip.scoring.llm import scan_hotwords_semantic
        with mock.patch("yuu_clip.scoring.llm._call_client", return_value=json.dumps(["big win"])):
            result = scan_hotwords_semantic("I won the jackpot!", ["big win", "sad moment"], self._cfg())
        assert result == ["big win"]

    def test_invented_phrase_not_in_input_is_filtered_out(self):
        import json
        import unittest.mock as mock

        from yuu_clip.scoring.llm import scan_hotwords_semantic
        payload = json.dumps(["big win", "a phrase the model made up"])
        with mock.patch("yuu_clip.scoring.llm._call_client", return_value=payload):
            result = scan_hotwords_semantic("I won the jackpot!", ["big win"], self._cfg())
        assert result == ["big win"]

    def test_non_list_response_raises_value_error(self):
        import json
        import unittest.mock as mock

        import pytest

        from yuu_clip.scoring.llm import scan_hotwords_semantic
        with mock.patch("yuu_clip.scoring.llm._call_client", return_value=json.dumps({"error": "bad"})):
            with pytest.raises(ValueError):
                scan_hotwords_semantic("text", ["phrase"], self._cfg())

    def test_invalid_json_retried_with_repair_request(self):
        import json
        import unittest.mock as mock

        from yuu_clip.scoring.llm import scan_hotwords_semantic
        responses = iter(["not json", json.dumps(["big win"])])

        def fake_call(messages, config, temperature=0.1, max_tokens=None):
            return next(responses)

        with mock.patch("yuu_clip.scoring.llm._call_client", side_effect=fake_call) as call:
            result = scan_hotwords_semantic("I won the jackpot!", ["big win"], self._cfg())
        assert result == ["big win"]
        assert call.call_count == 2


# ---------------------------------------------------------------------------
# hotword-scan route
# ---------------------------------------------------------------------------

class TestHotwordScanRoute:
    def _vid_id(self, client):
        return client.get("/api/videos").json()[0]["id"]

    def _seed_clip_with_excerpt(self, client, excerpt):
        vid_id = self._vid_id(client)
        clips = client.get(f"/api/videos/{vid_id}/clips").json()
        clip_id = clips[0]["id"]
        from yuu_clip.db.models import ClipCandidate, make_session
        db = make_session(client.app.state.ctx.db_path)
        clip = db.get(ClipCandidate, clip_id)
        clip.transcript_excerpt = excerpt
        db.commit()
        db.close()
        return vid_id, clip_id

    def _drain(self, client, video_id):
        import json
        messages = []
        with client.stream("GET", f"/api/videos/{video_id}/hotword-scan") as resp:
            status = resp.status_code
            for raw in resp.iter_lines():
                if raw.startswith("data: "):
                    messages.append(json.loads(raw[len("data: "):]))
        return status, messages

    def test_404_for_missing_video(self, client):
        assert client.get("/api/videos/99999/hotword-scan").status_code == 404

    def test_400_when_no_semantic_hotwords_configured(self, client):
        vid_id = self._vid_id(client)
        assert client.get(f"/api/videos/{vid_id}/hotword-scan").status_code == 400

    def test_exact_only_hotwords_do_not_satisfy_the_gate(self, client):
        vid_id = self._vid_id(client)
        client.post("/api/hotwords", json={
            "phrase": "haha", "match_mode": "exact", "boost": 0.1, "target": "funny", "enabled": True,
        })
        assert client.get(f"/api/videos/{vid_id}/hotword-scan").status_code == 400

    def test_scan_succeeds_without_llm(self, client):
        # Non-LLM tiers plan/01: the scan runs on the default keyword similarity
        # backend, so it no longer 503s when no LLM is available.
        vid_id = self._vid_id(client)
        client.post("/api/hotwords", json={
            "phrase": "big win", "match_mode": "semantic", "boost": 0.2, "target": "funny", "enabled": True,
        })
        r = client.get(f"/api/videos/{vid_id}/hotword-scan")
        assert r.status_code == 200

    def test_scan_applies_semantic_match_and_boost(self, client):
        # The default keyword backend matches "big win" when both content words
        # appear in the excerpt - no LLM needed.
        vid_id, clip_id = self._seed_clip_with_excerpt(client, "That was such a big win, we won it all!")
        client.post("/api/hotwords", json={
            "phrase": "big win", "match_mode": "semantic", "boost": 0.2, "target": "funny", "enabled": True,
        })

        status, messages = self._drain(client, vid_id)
        assert status == 200
        assert messages[-1] == "__DONE__"

        from yuu_clip.db.models import ClipCandidate, make_session
        db = make_session(client.app.state.ctx.db_path)
        clip = db.get(ClipCandidate, clip_id)
        matches = clip.hotword_matches
        boost = clip.hotword_boost
        db.close()
        assert matches == [{"phrase": "big win", "mode": "semantic", "count": 1}]
        assert boost["funny"] == 0.2

    def test_mixed_modes_text_rescan_preserves_semantic_match(self, client):
        """A text-only rescan (hotword-rescan) must not wipe out a semantic match
        applied by an earlier scan."""
        vid_id, clip_id = self._seed_clip_with_excerpt(client, "That was a big win! haha")
        client.post("/api/hotwords", json={
            "phrase": "big win", "match_mode": "semantic", "boost": 0.2, "target": "funny", "enabled": True,
        })
        client.post("/api/hotwords", json={
            "phrase": "haha", "match_mode": "exact", "boost": 0.1, "target": "funny", "enabled": True,
        })
        self._drain(client, vid_id)

        r = client.post(f"/api/videos/{vid_id}/hotword-rescan")
        assert r.status_code == 200

        from yuu_clip.db.models import ClipCandidate, make_session
        db = make_session(client.app.state.ctx.db_path)
        clip = db.get(ClipCandidate, clip_id)
        modes = sorted(m["mode"] for m in clip.hotword_matches)
        db.close()
        assert modes == ["exact", "semantic"]
