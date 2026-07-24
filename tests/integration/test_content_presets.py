"""Content-type presets (plan 12): the apply route.

Pure preset-table and prompt-flavor tests live in
tests/unit/test_content_presets.py; this file keeps only the tests that need
the seeded TestClient."""
from __future__ import annotations

from yuu_clip.content_presets import preset_by_id

# ── apply route ─────────────────────────────────────────────────────────────

def test_list_content_presets(client):
    body = client.get("/api/content-presets").json()
    assert body["active"] == "generic"
    ids = [p["id"] for p in body["presets"]]
    assert "generic" in ids and "competitive" in ids
    assert all("hotword_count" in p for p in body["presets"])


def test_apply_writes_weights_and_provenance(client):
    res = client.post("/api/content-presets/apply", json={"id": "competitive", "add_hotwords": False})
    assert res.status_code == 200
    body = res.json()
    assert body["applied"] == "competitive"
    assert body["hotwords_added"] == 0

    cfg = client.get("/api/config").json()
    assert cfg["content_preset"] == "competitive"
    assert cfg["score_action_weight"] == 1.8
    assert cfg["scorer_laugh_weight"] == 1.4


def test_apply_inserts_hotwords_once(client):
    preset = preset_by_id("competitive")
    expected = len(preset.starter_hotwords)

    first = client.post("/api/content-presets/apply", json={"id": "competitive", "add_hotwords": True}).json()
    assert first["hotwords_added"] == expected
    after_first = client.get("/api/hotwords").json()
    assert len(after_first) == expected

    # Re-applying is idempotent - the same phrases are skipped as duplicates.
    second = client.post("/api/content-presets/apply", json={"id": "competitive", "add_hotwords": True}).json()
    assert second["hotwords_added"] == 0
    assert len(client.get("/api/hotwords").json()) == expected


def test_apply_hotword_targets_match_spec(client):
    client.post("/api/content-presets/apply", json={"id": "competitive", "add_hotwords": True})
    rows = {hw["phrase"].lower(): hw for hw in client.get("/api/hotwords").json()}
    clutch = rows["clutch"]
    assert clutch["target"] == "action"
    assert clutch["match_mode"] == "case_insensitive"
    assert clutch["boost"] == 0.15


def test_apply_unknown_id_is_400(client):
    res = client.post("/api/content-presets/apply", json={"id": "nope"})
    assert res.status_code == 400


def test_apply_generic_resets_weights(client):
    client.post("/api/content-presets/apply", json={"id": "competitive", "add_hotwords": False})
    client.post("/api/content-presets/apply", json={"id": "generic", "add_hotwords": False})
    cfg = client.get("/api/config").json()
    assert cfg["content_preset"] == "generic"
    assert cfg["score_action_weight"] == 1.0
    assert cfg["scorer_laugh_weight"] == 1.5
