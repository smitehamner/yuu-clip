"""Content-type presets (plan 12): table integrity and prompt-flavor injection order."""
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
            # Presets nudge rather than dominate - modest, non-negative boosts.
            assert 0.0 < spec.boost <= 0.2, (preset.id, spec.phrase)


def test_non_generic_presets_have_flavor_and_hotwords():
    for preset in all_presets():
        if preset.id == "generic":
            continue
        assert preset.flavor.strip(), preset.id
        assert len(preset.starter_hotwords) >= 4, preset.id


def test_generic_is_a_true_noop_vs_config_defaults():
    """Selecting Generic must change nothing relative to Config()'s shipped
    defaults - drift in either place should fail here."""
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
