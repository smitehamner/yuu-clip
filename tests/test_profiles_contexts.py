from __future__ import annotations

import pytest


# ---------------------------------------------------------------------------
# Profiles
# ---------------------------------------------------------------------------

class TestProfiles:
    def test_list_profiles_includes_default(self, client):
        r = client.get("/api/profiles")
        assert r.status_code == 200
        profiles = r.json()
        names = [p["name"] for p in profiles]
        assert "__default__" in names
        default = next(p for p in profiles if p["name"] == "__default__")
        assert default["builtin"] is True

    def test_create_and_delete_profile(self, client):
        body = {
            "name": "test_profile",
            "assignments": [
                {"stream_position": 0, "label": "combined", "do_transcribe": True, "do_score": True},
                {"stream_position": 1, "label": "player_voice", "do_transcribe": True, "do_score": True},
            ],
        }
        r = client.post("/api/profiles", json=body)
        assert r.status_code == 200
        assert r.json()["name"] == "test_profile"

        profiles = client.get("/api/profiles").json()
        assert any(p["name"] == "test_profile" for p in profiles)

        r2 = client.delete("/api/profiles/test_profile")
        assert r2.status_code == 200

        profiles2 = client.get("/api/profiles").json()
        assert not any(p["name"] == "test_profile" for p in profiles2)

    def test_cannot_delete_builtin(self, client):
        r = client.delete("/api/profiles/__default__")
        assert r.status_code == 400

    def test_cannot_create_dunder_profile(self, client):
        r = client.post("/api/profiles", json={
            "name": "__evil__",
            "assignments": [],
        })
        assert r.status_code == 400


# ---------------------------------------------------------------------------
# Contexts
# ---------------------------------------------------------------------------

class TestContexts:
    def test_list_contexts_seeds_builtins(self, client):
        r = client.get("/api/contexts")
        assert r.status_code == 200
        contexts = r.json()
        context_ids = {c["context_id"] for c in contexts}
        expected = {"fantasy-rp", "multiplayer-shooter", "variety-stream", "horror-game", "speedrun", "sandbox-survival", "challenge-run"}
        assert expected <= context_ids
        assert all(c["builtin"] is True for c in contexts if c["context_id"] in expected)

    def test_create_and_list_context(self, client):
        body = {
            "context_id": "test-ctx",
            "display_name": "Test Context",
            "setting": "A fantasy world",
            "your_characters": "Hero",
            "other_characters": "Villain",
            "notes": "Fun campaign",
        }
        r = client.post("/api/contexts", json=body)
        assert r.status_code == 200
        d = r.json()
        assert d["context_id"] == "test-ctx"
        assert d["display_name"] == "Test Context"
        assert d["setting"] == "A fantasy world"

        contexts = client.get("/api/contexts").json()
        assert any(c["context_id"] == "test-ctx" for c in contexts)

    def test_upsert_updates_existing(self, client):
        body = {"context_id": "upd-ctx", "display_name": "Old Name", "setting": "old"}
        client.post("/api/contexts", json=body)
        r = client.post("/api/contexts", json={**body, "display_name": "New Name", "setting": "new"})
        assert r.status_code == 200
        assert r.json()["display_name"] == "New Name"

    def test_delete_context(self, client):
        client.post("/api/contexts", json={"context_id": "del-ctx", "display_name": "To Delete"})
        r = client.delete("/api/contexts/del-ctx")
        assert r.status_code == 200
        contexts = client.get("/api/contexts").json()
        assert not any(c["context_id"] == "del-ctx" for c in contexts)

    def test_delete_context_404(self, client):
        r = client.delete("/api/contexts/nonexistent")
        assert r.status_code == 404

    def test_create_context_invalid_id(self, client):
        r = client.post("/api/contexts", json={"context_id": "bad slug!", "display_name": "X"})
        assert r.status_code == 400

    def test_create_context_empty_id(self, client):
        r = client.post("/api/contexts", json={"context_id": "", "display_name": "X"})
        assert r.status_code == 400


# ---------------------------------------------------------------------------
# Profile delete — nonexistent name is a no-op
# ---------------------------------------------------------------------------

class TestProfileDeleteNonexistent:
    def test_delete_nonexistent_profile_returns_200(self, client):
        """Deleting a nonexistent profile is a silent no-op (matches delete_profile impl)."""
        r = client.delete("/api/profiles/does_not_exist")
        assert r.status_code == 200
        assert r.json()["deleted"] == "does_not_exist"


# ---------------------------------------------------------------------------
# contexts.py — load/save/seed unit tests
# ---------------------------------------------------------------------------

class TestLoadSaveContexts:
    def test_load_contexts_returns_empty_when_no_file(self, tmp_path):
        from yuu_clip.contexts import load_contexts
        assert load_contexts(tmp_path) == {}

    def test_save_and_load_roundtrip(self, tmp_path):
        from yuu_clip.contexts import load_contexts, save_contexts
        data = {"my-ctx": {"display_name": "My Ctx", "setting": "A world"}}
        save_contexts(tmp_path, data)
        assert load_contexts(tmp_path) == data

    def test_save_creates_parent_dirs(self, tmp_path):
        from yuu_clip.contexts import save_contexts, load_contexts
        nested = tmp_path / "deep" / "project"
        save_contexts(nested, {"x": {"display_name": "X"}})
        assert load_contexts(nested) == {"x": {"display_name": "X"}}

    def test_seed_builtin_contexts_writes_all_builtins(self, tmp_path):
        from yuu_clip.contexts import seed_builtin_contexts, load_contexts, BUILTIN_IDS
        seed_builtin_contexts(tmp_path)
        result = load_contexts(tmp_path)
        assert BUILTIN_IDS <= set(result)

    def test_seed_builtin_contexts_does_not_overwrite_existing(self, tmp_path):
        from yuu_clip.contexts import seed_builtin_contexts, save_contexts, load_contexts
        existing = {"fantasy-rp": {"display_name": "Custom", "setting": "changed"}}
        save_contexts(tmp_path, existing)
        seed_builtin_contexts(tmp_path)
        result = load_contexts(tmp_path)
        assert result["fantasy-rp"]["display_name"] == "Custom"

    def test_seed_builtin_contexts_adds_timestamps(self, tmp_path):
        from yuu_clip.contexts import seed_builtin_contexts, load_contexts
        seed_builtin_contexts(tmp_path)
        result = load_contexts(tmp_path)
        ctx = result["fantasy-rp"]
        assert "created_at" in ctx
        assert "updated_at" in ctx

    def test_seed_is_idempotent(self, tmp_path):
        from yuu_clip.contexts import seed_builtin_contexts, load_contexts
        seed_builtin_contexts(tmp_path)
        first = load_contexts(tmp_path)
        seed_builtin_contexts(tmp_path)
        second = load_contexts(tmp_path)
        assert first == second


# ---------------------------------------------------------------------------
# config.py — load_profiles / save_profile / delete_profile unit tests
# ---------------------------------------------------------------------------

class TestProfileFunctions:
    def test_load_profiles_returns_empty_when_no_file(self, monkeypatch, tmp_path):
        from yuu_clip import config as cfg_mod
        monkeypatch.setattr(cfg_mod, "_profiles_path", lambda: tmp_path / "profiles.json")
        from yuu_clip.config import load_profiles
        assert load_profiles() == {}

    def test_save_and_load_profile(self, monkeypatch, tmp_path):
        from yuu_clip import config as cfg_mod
        monkeypatch.setattr(cfg_mod, "_profiles_path", lambda: tmp_path / "profiles.json")
        from yuu_clip.config import save_profile, load_profiles
        assignments = [{"stream_position": 0, "label": "combined", "do_transcribe": True, "do_score": True}]
        save_profile("my_layout", assignments)
        result = load_profiles()
        assert "my_layout" in result
        assert result["my_layout"]["assignments"] == assignments
        assert result["my_layout"]["num_tracks"] == 1

    def test_save_profile_overwrites_existing(self, monkeypatch, tmp_path):
        from yuu_clip import config as cfg_mod
        monkeypatch.setattr(cfg_mod, "_profiles_path", lambda: tmp_path / "profiles.json")
        from yuu_clip.config import save_profile, load_profiles
        save_profile("p", [{"stream_position": 0, "label": "old"}])
        save_profile("p", [{"stream_position": 0, "label": "new"}, {"stream_position": 1, "label": "voice"}])
        result = load_profiles()
        assert result["p"]["num_tracks"] == 2
        assert result["p"]["assignments"][0]["label"] == "new"

    def test_delete_profile_removes_entry(self, monkeypatch, tmp_path):
        from yuu_clip import config as cfg_mod
        monkeypatch.setattr(cfg_mod, "_profiles_path", lambda: tmp_path / "profiles.json")
        from yuu_clip.config import save_profile, delete_profile, load_profiles
        save_profile("to_remove", [])
        delete_profile("to_remove")
        assert "to_remove" not in load_profiles()

    def test_delete_profile_nonexistent_is_no_op(self, monkeypatch, tmp_path):
        from yuu_clip import config as cfg_mod
        monkeypatch.setattr(cfg_mod, "_profiles_path", lambda: tmp_path / "profiles.json")
        from yuu_clip.config import delete_profile, load_profiles
        delete_profile("ghost")
        assert load_profiles() == {}
