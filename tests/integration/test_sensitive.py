"""Sensitive content detection (roadmap plan 06): client-bound CRUD/rescan
route tests.

Term values are user PII by definition, so a dedicated logging-safety test drives
every route that touches a term value and asserts it never appears in the actual log
sink the user sends us (mirrors the "never log term values" rule in routes/sensitive.py
and SensitiveTerm's docstring).

Pure fuzzy-matcher and apply_sensitive_scan logic moved to
tests/unit/test_sensitive.py.
"""
from __future__ import annotations

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
        # TestSensitiveTermSaveTriggersRescan) - this route is for the other
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
# Stage 3 - context_slug on the CRUD surface
# ---------------------------------------------------------------------------

class TestSensitiveTermContextSlugCrud:
    def test_create_defaults_to_global_null_slug(self, client):
        body = client.post("/api/sensitive-terms", json={
            "term": "John", "category": "privacy", "match_mode": "exact", "enabled": True,
        }).json()
        assert body["context_slug"] is None

    def test_create_with_known_context_slug(self, client):
        body = client.post("/api/sensitive-terms", json={
            "term": "Thornwood", "category": "privacy", "match_mode": "exact",
            "enabled": True, "context_slug": "fantasy-rp",
        }).json()
        assert body["context_slug"] == "fantasy-rp"

    def test_create_rejects_unknown_context_slug(self, client):
        r = client.post("/api/sensitive-terms", json={
            "term": "John", "category": "privacy", "match_mode": "exact",
            "enabled": True, "context_slug": "no-such-context",
        })
        assert r.status_code == 400

    def test_empty_string_slug_stored_as_global(self, client):
        body = client.post("/api/sensitive-terms", json={
            "term": "John", "category": "privacy", "match_mode": "exact",
            "enabled": True, "context_slug": "",
        }).json()
        assert body["context_slug"] is None

    def test_orphaned_term_can_still_be_edited(self, client):
        created = client.post("/api/sensitive-terms", json={
            "term": "Thornwood", "category": "privacy", "match_mode": "exact",
            "enabled": True, "context_slug": "fantasy-rp",
        }).json()
        from yuu_clip.db.models import SensitiveTerm, make_session
        db = make_session(client.app.state.ctx.db_path)
        db.get(SensitiveTerm, created["id"]).context_slug = "deleted-context"
        db.commit()
        db.close()
        r = client.put(f"/api/sensitive-terms/{created['id']}", json={
            "term": "Thornwood", "category": "censor", "match_mode": "exact",
            "enabled": True, "context_slug": "deleted-context",
        })
        assert r.status_code == 200
        assert r.json()["category"] == "censor"


# ---------------------------------------------------------------------------
# Stage 2 - context-scoped flagging (project-wide rescan on save)
# ---------------------------------------------------------------------------

class TestSensitiveContextScoping:
    def _seed_video_context(self, client, context_ids):
        import json as _json

        from yuu_clip.db.models import ClipCandidate, Video, make_session
        vid_id = client.get("/api/videos").json()[0]["id"]
        db = make_session(client.app.state.ctx.db_path)
        video = db.get(Video, vid_id)
        video.context_names_json = _json.dumps(context_ids)
        clip = db.query(ClipCandidate).filter_by(video_id=vid_id).first()
        clip.transcript_excerpt = "John walked into the room"
        db.commit()
        db.close()
        return vid_id

    def test_context_term_flags_matching_recording(self, client):
        self._seed_video_context(client, ["fantasy-rp"])
        r = client.post("/api/sensitive-terms", json={
            "term": "John", "category": "privacy", "match_mode": "exact",
            "enabled": True, "context_slug": "fantasy-rp",
        })
        assert r.json()["clips_flagged"] == 1

    def test_context_term_skips_unmatched_recording(self, client):
        self._seed_video_context(client, ["multiplayer-shooter"])
        r = client.post("/api/sensitive-terms", json={
            "term": "John", "category": "privacy", "match_mode": "exact",
            "enabled": True, "context_slug": "fantasy-rp",
        })
        assert r.json()["clips_flagged"] == 0

    def test_global_term_flags_context_tagged_recording(self, client):
        self._seed_video_context(client, ["fantasy-rp"])
        r = client.post("/api/sensitive-terms", json={
            "term": "John", "category": "privacy", "match_mode": "exact", "enabled": True,
        })
        assert r.json()["clips_flagged"] == 1

    def test_per_video_rescan_honors_scope(self, client):
        vid_id = self._seed_video_context(client, ["fantasy-rp"])
        # Scoped to a context the recording is NOT tagged with -> stays inert even
        # when a later transcript-driven rescan runs.
        client.post("/api/sensitive-terms", json={
            "term": "John", "category": "privacy", "match_mode": "exact",
            "enabled": True, "context_slug": "multiplayer-shooter",
        })
        r = client.post(f"/api/videos/{vid_id}/sensitive-rescan")
        assert r.status_code == 200
        assert r.json()["clips_changed"] == 0


# ---------------------------------------------------------------------------
# Logging safety - term values must never appear in logs
# ---------------------------------------------------------------------------

class TestSensitiveTermValuesNeverLogged:
    _SECRET_TERM = "SuperSecretPersonName12345"

    def test_crud_and_rescan_never_log_the_term_value(self, client):
        # Assert against the real in-memory sink (what the log download exposes)
        # rather than caplog: the yuu_clip logger does not propagate to root, so
        # caplog - which attaches to root - would capture nothing and pass vacuously.
        from yuu_clip.log import recent_log_lines
        baseline = len(recent_log_lines())

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

        emitted = "\n".join(recent_log_lines()[baseline:])
        assert self._SECRET_TERM not in emitted
