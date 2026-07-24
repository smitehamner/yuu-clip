"""Hot-word / phrase config (roadmap plan 03): client-bound CRUD/rescan/scan
route tests.

Pure matcher and boost-application logic moved to tests/unit/test_hotwords.py."""
from __future__ import annotations

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
        assert messages[-1] == {"v": 1, "type": "done", "outcome": "ok"}

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
