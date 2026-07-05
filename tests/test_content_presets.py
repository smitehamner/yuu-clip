"""Content-type presets (plan 12): table integrity, generic no-op, prompt-flavor
injection order, and the apply route."""
from __future__ import annotations

from yuu_clip.config import Config
from yuu_clip.content_presets import (
    DEFAULT_PRESET_ID,
    all_presets,
    is_valid_preset_id,
    preset_by_id,
    preset_flavor,
)
from yuu_clip.scoring.llm import _active_flavor, _compose_system

_VALID_TARGETS = {"overall", "funny", "dramatic", "action"}
_VALID_MODES = {"exact", "case_insensitive", "semantic"}
_WEIGHT_KEYS = {"score_funny_weight", "score_dramatic_weight", "score_action_weight"}


# ── preset table integrity ──────────────────────────────────────────────────

def test_preset_ids_unique():
    ids = [p.id for p in all_presets()]
    assert len(ids) == len(set(ids))


def test_generic_is_first_and_default():
    assert all_presets()[0].id == DEFAULT_PRESET_ID == "generic"


def test_dimension_weights_well_formed_and_in_range():
    for preset in all_presets():
        assert set(preset.dimension_weights) == _WEIGHT_KEYS, preset.id
        for value in preset.dimension_weights.values():
            assert 0.0 <= value <= 5.0, preset.id
        assert 0.0 <= preset.laugh_weight <= 5.0, preset.id


def test_starter_hotwords_valid():
    for preset in all_presets():
        for spec in preset.starter_hotwords:
            assert spec.phrase.strip(), preset.id
            assert spec.target in _VALID_TARGETS, (preset.id, spec.phrase)
            assert spec.match_mode in _VALID_MODES, (preset.id, spec.phrase)
            # Presets nudge rather than dominate — modest, non-negative boosts.
            assert 0.0 < spec.boost <= 0.2, (preset.id, spec.phrase)


def test_non_generic_presets_have_flavor_and_hotwords():
    for preset in all_presets():
        if preset.id == "generic":
            continue
        assert preset.flavor.strip(), preset.id
        assert len(preset.starter_hotwords) >= 4, preset.id


def test_generic_is_a_true_noop_vs_config_defaults():
    """Selecting Generic must change nothing relative to Config()'s shipped
    defaults — drift in either place should fail here."""
    generic = preset_by_id("generic")
    defaults = Config()
    assert generic.flavor == ""
    assert generic.dimension_weights == {
        "score_funny_weight": defaults.score_funny_weight,
        "score_dramatic_weight": defaults.score_dramatic_weight,
        "score_action_weight": defaults.score_action_weight,
    }
    assert generic.laugh_weight == defaults.scorer_laugh_weight
    assert defaults.content_preset == "generic"


def test_is_valid_preset_id():
    assert is_valid_preset_id("competitive")
    assert not is_valid_preset_id("nope")


# ── prompt flavor injection ─────────────────────────────────────────────────

def test_preset_flavor_lookup():
    assert preset_flavor("generic") == ""
    assert preset_flavor("unknown-id") == ""
    assert preset_flavor("speedrun") == preset_by_id("speedrun").flavor


def test_active_flavor_reads_config():
    assert _active_flavor(Config()) == ""
    assert _active_flavor(Config(content_preset="podcast")) == preset_by_id("podcast").flavor


def test_compose_system_order_context_flavor_base():
    flavor = preset_by_id("competitive").flavor
    out = _compose_system("BASE_PROMPT", "WORLD_CONTEXT", Config(content_preset="competitive"))
    assert out.index("WORLD_CONTEXT") < out.index(flavor) < out.index("BASE_PROMPT")


def test_compose_system_generic_is_context_only():
    assert _compose_system("BASE", "CTX", Config()) == "CTX\n\nBASE"
    assert _compose_system("BASE", "", Config()) == "BASE"


def test_compose_system_flavor_without_context():
    flavor = preset_by_id("speedrun").flavor
    assert _compose_system("BASE", "", Config(content_preset="speedrun")) == f"{flavor}\n\nBASE"


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

    # Re-applying is idempotent — the same phrases are skipped as duplicates.
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
