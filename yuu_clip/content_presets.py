"""
Content-type presets (plan 12) - one-choice tuning for different streaming styles.

Each preset bundles recommended scoring-dimension weights, a laugh weight, a short
LLM "flavor" paragraph that steers scoring / summary / timeline prompts, and a few
starter hot-words. Applying a preset *copies* the weights into config and (opt-in)
inserts the hot-words once; the flavor is read *live* from Config.content_preset at
prompt-assembly time (see scoring/llm.py) so flavor text stays improvable in updates
without a re-apply.

Built-in only - no user-defined content presets in v1. Pattern mirrors
export_presets.py / model_catalog.py: frozen dataclasses, a static tuple, and small
unit-testable lookup helpers. The "generic" preset is exactly today's default
behavior - empty flavor plus the shipped Config() default weights - so selecting it
is a true no-op (asserted against Config() in tests/integration/test_content_presets.py).
"""
from __future__ import annotations

from dataclasses import dataclass

DEFAULT_PRESET_ID = "generic"


@dataclass(frozen=True)
class HotWordSpec:
    """A starter hot-word an applied preset offers to insert. boost is on the 0–1
    score scale; presets stay modest (≤ 0.2) so they nudge rather than dominate."""
    phrase: str
    target: str            # "overall" | "funny" | "dramatic" | "action"
    boost: float
    match_mode: str = "case_insensitive"


@dataclass(frozen=True)
class ContentPreset:
    id: str                                # stable id, kebab-case
    name: str                              # user-facing
    description: str                       # one-line
    dimension_weights: dict                # score_{funny,dramatic,action}_weight
    laugh_weight: float                    # scorer_laugh_weight
    flavor: str                            # LLM prompt paragraph ("" for generic)
    starter_hotwords: tuple[HotWordSpec, ...] = ()

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "dimension_weights": dict(self.dimension_weights),
            "laugh_weight": self.laugh_weight,
            "hotword_count": len(self.starter_hotwords),
        }


def _weights(funny: float, dramatic: float, action: float) -> dict:
    return {
        "score_funny_weight": funny,
        "score_dramatic_weight": dramatic,
        "score_action_weight": action,
    }


# Generic is defined from the same numbers as Config()'s defaults so that
# selecting it changes nothing - the test pins this against Config() exactly.
_GENERIC = ContentPreset(
    id="generic",
    name="Generic",
    description="Balanced default - no content-specific tuning.",
    dimension_weights=_weights(1.0, 1.0, 1.0),
    laugh_weight=1.5,
    flavor="",
)

_RP_NARRATIVE = ContentPreset(
    id="rp-narrative",
    name="RP / narrative",
    description="Roleplay or story-driven sessions - character and drama first.",
    dimension_weights=_weights(1.0, 1.6, 0.8),
    laugh_weight=1.2,
    flavor=(
        "This is a roleplay or story-driven session. The best highlights are dramatic "
        "confrontations, character revelations and relationship moments, lore drops, and "
        "emotional payoffs - use character names whenever the transcript gives them. Weigh "
        "dramatic, character-driven beats above raw mechanical action."
    ),
    starter_hotwords=(
        HotWordSpec("I trusted you", "dramatic", 0.15),
        HotWordSpec("how could you", "dramatic", 0.12),
        HotWordSpec("we need to talk", "dramatic", 0.12),
        HotWordSpec("I'm sorry", "dramatic", 0.10),
        HotWordSpec("you're alive", "dramatic", 0.12),
    ),
)

_COMPETITIVE = ContentPreset(
    id="competitive",
    name="Competitive gaming",
    description="Ranked or competitive play - clutches, comebacks, and callouts.",
    dimension_weights=_weights(1.0, 1.1, 1.8),
    laugh_weight=1.4,
    flavor=(
        "This is competitive multiplayer gameplay. The best highlights are clutch plays, "
        "comebacks from a losing position, high-skill mechanical moments, sharp callouts, and "
        "big swings in momentum - plus the tilt, trash talk, and celebration around them. Weigh "
        "decisive in-game action and the reactions to it above quiet stretches."
    ),
    starter_hotwords=(
        HotWordSpec("clutch", "action", 0.15),
        HotWordSpec("comeback", "action", 0.15),
        HotWordSpec("ace", "action", 0.12),
        HotWordSpec("let's go", "action", 0.10),
        HotWordSpec("no way", "overall", 0.10),
    ),
)

_CASUAL = ContentPreset(
    id="casual",
    name="Casual / let's play",
    description="Relaxed let's-plays - personality, reactions, and funny failures.",
    dimension_weights=_weights(1.6, 0.8, 1.0),
    laugh_weight=1.8,
    flavor=(
        "This is a casual let's-play session where the streamer's personality carries the "
        "highlights. The best moments are genuine reactions, funny failures, running gags, "
        "surprise, and off-hand commentary - more than mechanical skill. Weigh humor and "
        "reaction over competitive stakes."
    ),
    starter_hotwords=(
        HotWordSpec("oh no", "funny", 0.10),
        HotWordSpec("what just happened", "funny", 0.12),
        HotWordSpec("are you kidding", "funny", 0.12),
        HotWordSpec("that was amazing", "overall", 0.10),
        HotWordSpec("I can't believe", "funny", 0.10),
    ),
)

_SPEEDRUN = ContentPreset(
    id="speedrun",
    name="Speedrun",
    description="Runs against the clock - splits, PBs, and heartbreak resets.",
    dimension_weights=_weights(0.9, 1.4, 1.5),
    laugh_weight=1.2,
    flavor=(
        "This is a speedrun or routing session. The best highlights track the run against the "
        "clock: strong and gold splits, world-record or personal-best pace, clutch execution of "
        "hard tricks, and the heartbreak of a run-killing mistake or reset. Talk about the run, "
        "splits, and pace rather than story or character."
    ),
    starter_hotwords=(
        HotWordSpec("personal best", "overall", 0.15),
        HotWordSpec("world record", "overall", 0.20),
        HotWordSpec("gold split", "overall", 0.15),
        HotWordSpec("run killer", "dramatic", 0.12),
        HotWordSpec("let's go", "action", 0.10),
    ),
)

_PODCAST = ContentPreset(
    id="podcast",
    name="Podcast / conversation",
    description="Talk-driven sessions - quotes, hot takes, and shared laughter.",
    dimension_weights=_weights(1.6, 1.3, 0.2),
    laugh_weight=1.8,
    flavor=(
        "This is a conversation or podcast-style session where talk, not gameplay, drives the "
        "highlights. The best moments are topic changes, memorable quotes and hot takes, genuine "
        "disagreements, funny tangents, and shared laughter. On-screen action barely matters "
        "here - weigh what is said and the chemistry between people."
    ),
    starter_hotwords=(
        HotWordSpec("hot take", "overall", 0.12),
        HotWordSpec("unpopular opinion", "overall", 0.12),
        HotWordSpec("I disagree", "dramatic", 0.12),
        HotWordSpec("wait, what", "funny", 0.10),
        HotWordSpec("that's hilarious", "funny", 0.10),
    ),
)


# Generic first (it's the default and the "reset" choice), then the specific styles.
PRESETS: tuple[ContentPreset, ...] = (
    _GENERIC, _RP_NARRATIVE, _COMPETITIVE, _CASUAL, _SPEEDRUN, _PODCAST,
)

_BY_ID: dict[str, ContentPreset] = {preset.id: preset for preset in PRESETS}


def all_presets() -> list[ContentPreset]:
    return list(PRESETS)


def preset_by_id(preset_id: str) -> ContentPreset | None:
    return _BY_ID.get(preset_id)


def is_valid_preset_id(preset_id: str) -> bool:
    return preset_id in _BY_ID


def preset_flavor(preset_id: str) -> str:
    """The live flavor paragraph for *preset_id*, or '' for generic/unknown."""
    preset = _BY_ID.get(preset_id)
    return preset.flavor if preset else ""
