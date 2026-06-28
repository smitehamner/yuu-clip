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

    def test_cannot_create_whitespace_profile(self, client):
        r = client.post("/api/profiles", json={"name": "   ", "assignments": []})
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

    def test_cannot_delete_builtin_context(self, client):
        r = client.delete("/api/contexts/fantasy-rp")
        assert r.status_code == 400

    def test_builtin_context_survives_delete_attempt(self, client):
        client.delete("/api/contexts/fantasy-rp")
        contexts = client.get("/api/contexts").json()
        assert any(c["context_id"] == "fantasy-rp" for c in contexts)


# ---------------------------------------------------------------------------
# Profile delete — nonexistent name is a no-op
# ---------------------------------------------------------------------------

class TestProfileDeleteNonexistent:
    def test_delete_nonexistent_profile_returns_200(self, client):
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
# contexts.py — extract_context_weights unit tests
# ---------------------------------------------------------------------------

class TestExtractContextWeights:
    def test_empty_context_ids_returns_all_none(self):
        from yuu_clip.contexts import extract_context_weights
        result = extract_context_weights({}, [])
        assert result == {"score_funny_weight": None, "score_dramatic_weight": None, "score_action_weight": None}

    def test_missing_context_id_is_skipped(self):
        from yuu_clip.contexts import extract_context_weights
        result = extract_context_weights({}, ["does-not-exist"])
        assert result["score_funny_weight"] is None

    def test_single_weight_returned(self):
        from yuu_clip.contexts import extract_context_weights
        contexts = {"a": {"score_funny_weight": 2.0, "score_dramatic_weight": None, "score_action_weight": None}}
        result = extract_context_weights(contexts, ["a"])
        assert result["score_funny_weight"] == 2.0
        assert result["score_dramatic_weight"] is None

    def test_averages_across_multiple_contexts(self):
        from yuu_clip.contexts import extract_context_weights
        contexts = {
            "a": {"score_funny_weight": 1.0, "score_dramatic_weight": None, "score_action_weight": 3.0},
            "b": {"score_funny_weight": 3.0, "score_dramatic_weight": None, "score_action_weight": 1.0},
        }
        result = extract_context_weights(contexts, ["a", "b"])
        assert result["score_funny_weight"] == 2.0
        assert result["score_dramatic_weight"] is None
        assert result["score_action_weight"] == 2.0

    def test_only_set_contexts_contribute_to_average(self):
        from yuu_clip.contexts import extract_context_weights
        contexts = {
            "a": {"score_funny_weight": 4.0},
            "b": {"score_funny_weight": None},
        }
        result = extract_context_weights(contexts, ["a", "b"])
        assert result["score_funny_weight"] == 4.0


# ---------------------------------------------------------------------------
# contexts.py — format_context_block unit tests
# ---------------------------------------------------------------------------

class TestFormatContextBlock:
    def test_empty_list_returns_empty_string(self):
        from yuu_clip.contexts import format_context_block
        assert format_context_block({}, []) == ""

    def test_missing_context_id_is_skipped(self):
        from yuu_clip.contexts import format_context_block
        assert format_context_block({}, ["not-there"]) == ""

    def test_single_context_with_fields(self):
        from yuu_clip.contexts import format_context_block
        contexts = {"my-ctx": {"display_name": "My World", "setting": "A dark forest", "your_characters": "Hero", "other_characters": "", "notes": ""}}
        block = format_context_block(contexts, ["my-ctx"])
        assert "WORLD CONTEXT: My World" in block
        assert "A dark forest" in block
        assert "Hero" in block
        assert "END CONTEXT" in block

    def test_empty_fields_omitted(self):
        from yuu_clip.contexts import format_context_block
        contexts = {"ctx": {"display_name": "C", "setting": "", "your_characters": "", "other_characters": "", "notes": ""}}
        block = format_context_block(contexts, ["ctx"])
        assert "[Setting]" not in block
        assert "WORLD CONTEXT: C" in block

    def test_multiple_contexts_joined(self):
        from yuu_clip.contexts import format_context_block
        contexts = {
            "a": {"display_name": "A", "setting": "world A", "your_characters": "", "other_characters": "", "notes": ""},
            "b": {"display_name": "B", "setting": "world B", "your_characters": "", "other_characters": "", "notes": ""},
        }
        block = format_context_block(contexts, ["a", "b"])
        assert "WORLD CONTEXT: A" in block
        assert "WORLD CONTEXT: B" in block


# ---------------------------------------------------------------------------
# contexts route — weight fields and display_name fallback
# ---------------------------------------------------------------------------

class TestContextWeightFields:
    def test_weight_fields_round_trip(self, client):
        body = {
            "context_id": "weighted-ctx",
            "display_name": "Weighted",
            "score_funny_weight": 1.5,
            "score_dramatic_weight": 0.5,
            "score_action_weight": None,
        }
        r = client.post("/api/contexts", json=body)
        assert r.status_code == 200
        d = r.json()
        assert d["score_funny_weight"] == 1.5
        assert d["score_dramatic_weight"] == 0.5
        assert d["score_action_weight"] is None

    def test_weight_fields_default_to_none_in_list(self, client):
        client.post("/api/contexts", json={"context_id": "no-weights", "display_name": "No weights"})
        contexts = client.get("/api/contexts").json()
        ctx = next(c for c in contexts if c["context_id"] == "no-weights")
        assert ctx["score_funny_weight"] is None
        assert ctx["score_dramatic_weight"] is None
        assert ctx["score_action_weight"] is None

    def test_display_name_falls_back_to_context_id(self, client):
        r = client.post("/api/contexts", json={"context_id": "fallback-ctx", "display_name": ""})
        assert r.status_code == 200
        assert r.json()["display_name"] == "fallback-ctx"

    def test_upsert_preserves_created_at(self, tmp_path):
        from yuu_clip.contexts import save_contexts, load_contexts
        from datetime import datetime, timezone
        original_ts = "2024-01-01T00:00:00+00:00"
        save_contexts(tmp_path, {"my-ctx": {"display_name": "V1", "created_at": original_ts, "updated_at": original_ts}})
        contexts = load_contexts(tmp_path)
        existing = contexts["my-ctx"]
        contexts["my-ctx"] = {**existing, "display_name": "V2", "updated_at": datetime.now(timezone.utc).isoformat()}
        save_contexts(tmp_path, contexts)
        result = load_contexts(tmp_path)
        assert result["my-ctx"]["created_at"] == original_ts
        assert result["my-ctx"]["display_name"] == "V2"

    def test_list_response_omits_timestamps(self, client):
        client.post("/api/contexts", json={"context_id": "ts-check", "display_name": "TS"})
        contexts = client.get("/api/contexts").json()
        ctx = next(c for c in contexts if c["context_id"] == "ts-check")
        assert "created_at" not in ctx
        assert "updated_at" not in ctx


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
