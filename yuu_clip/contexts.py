"""
World context storage and formatting.

Contexts are named blobs of world knowledge (setting, characters, notes) that
get injected into every LLM prompt so the model understands who is in a session.

Stored per-project in .yuu-clip/contexts.json.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path

_log = logging.getLogger(__name__)

_CONTEXTS_FILE = "contexts.json"

_FIELDS = [
    ("setting",           "Setting"),
    ("your_characters",   "Your player(s)"),
    ("other_characters",  "Other players & NPCs"),
    ("notes",             "Notes"),
]

BUILTIN_CONTEXTS: dict[str, dict] = {
    "fantasy-rp": {
        "display_name": "Fantasy RP",
        "setting": "Fantasy roleplay session - tabletop RPG over VTT, or MMORPG RP. Players speak in-character and react to story events and each other.",
        "your_characters": "",
        "other_characters": "",
        "notes": "Add your character name, other player names, and DM/GM. Great highlights: dramatic reveals, character deaths or near-deaths, emotional payoffs, funny in-character misunderstandings, and recurring group bits.",
    },
    "multiplayer-shooter": {
        "display_name": "Multiplayer Shooter",
        "setting": "Multiplayer shooter - FPS, TPS, or hero shooter (e.g. Apex, Overwatch, Valorant, Call of Duty). Players react in real-time to gunfights, team plays, and match events.",
        "your_characters": "",
        "other_characters": "",
        "notes": "Add your game, role or agent, and squad names. Great highlights: clutch multi-kills, comeback rounds, funny team comms, impossible survival moments, ace or squad-wipe reactions.",
    },
    "variety-stream": {
        "display_name": "Variety Stream",
        "setting": "Variety gaming session spanning multiple games or genres. Personality and reactions drive highlights more than any specific game mechanic.",
        "your_characters": "",
        "other_characters": "",
        "notes": "Add your handle and frequent co-commentators or guests. Great highlights: genuine surprise reactions, running gags, funny failures, community callbacks, and anything worth clipping for social media.",
    },
    "battle-royale": {
        "display_name": "Battle Royale",
        "setting": "Battle royale game (e.g. Apex Legends, Fortnite, PUBG, Warzone). Squads compete to be last standing; tension naturally escalates toward final circles.",
        "your_characters": "",
        "other_characters": "",
        "notes": "Add your game, squad names, and legend or character. Great highlights: final-circle clutches, squad wipes, unexpected revives, long-range eliminations, funny third-party moments.",
    },
    "horror-game": {
        "display_name": "Horror Game",
        "setting": "Horror game session. The key highlight shape is reaction - buildup of dread, the scare itself, and the immediate aftermath. Co-op horror adds group panic and blame.",
        "your_characters": "",
        "other_characters": "",
        "notes": "Add your game and any co-op partners. Great highlights: jump scare reactions, tense survival close-calls, funny nervous commentary, unexpected deaths, first enemy encounters.",
    },
    "mmo-rp": {
        "display_name": "MMO / Social RP",
        "setting": "Persistent-world social or RP server (e.g. GTA RP / FiveM, FFXIV RP, ESO). Characters have ongoing story arcs, factions, and relationships within a shared world.",
        "your_characters": "",
        "other_characters": "",
        "notes": "Add your character name, faction or organization, server, and key recurring players. Great highlights: lore reveals, faction conflicts, character relationship moments, funny in-world incidents.",
    },
    "soulslike": {
        "display_name": "Soulslike / Boss Rush",
        "setting": "Difficult action game with punishing deaths and hard boss fights (e.g. Elden Ring, Dark Souls, Sekiro, Lies of P). The emotional arc across repeated attempts leading to a boss kill is the core highlight shape.",
        "your_characters": "",
        "other_characters": "",
        "notes": "Add your game and any active challenge run (e.g. 'Blind playthrough' or 'No-hit run'). Great highlights: boss kill reactions after many deaths, hype comeback moments, funny or absurd deaths, impossible-looking clutch plays.",
    },
    "speedrun": {
        "display_name": "Speedrun",
        "setting": "Speedrun attempt or routing practice. The highlight arc runs split-by-split - ahead of pace creates tension, a death or reset is a dramatic beat, a PB or WR finish is the payoff.",
        "your_characters": "",
        "other_characters": "",
        "notes": "Add your game, category (e.g. 'Any%', 'All Dungeons'), and current PB and WR to compare against. Great highlights: PB splits, WR-pace moments, hype routing decisions, heartbreak resets, finish-line reactions.",
    },
    "sandbox-survival": {
        "display_name": "Sandbox / Survival",
        "setting": "Sandbox or survival game (e.g. Minecraft, Valheim, Terraria). Sessions mix exploration, building, combat, and long-term project goals across many hours of play.",
        "your_characters": "",
        "other_characters": "",
        "notes": "Add your current world goal or project (e.g. 'Hardcore day 40' or 'building a mega base'). Great highlights: building reveals, unexpected deaths especially in Hardcore, first boss kills, funny accidental disasters, major progression milestones.",
    },
    "challenge-run": {
        "display_name": "Challenge Run",
        "setting": "Game with self-imposed challenge rules that raise stakes (e.g. Pokémon Nuzlocke, randomizer, Ironman mode). Losses are permanent or heavily penalized, making failures and survival equally dramatic.",
        "your_characters": "",
        "other_characters": "",
        "notes": "Add your game, full ruleset (e.g. 'Nuzlocke - faint = release'), and any named party members or key units. Great highlights: unexpected loss of a beloved team member, low-HP clutch survival, restrictions creating funny situations, gym or boss victories against the odds.",
    },
    "podcast": {
        "display_name": "Podcast / Talk Show",
        "setting": "Conversation- or podcast-style session where talk, not gameplay, drives the highlights. Hosts and guests riff on topics, tell stories, and react to each other.",
        "your_characters": "",
        "other_characters": "",
        "notes": "Add the host(s), recurring co-hosts or guests, and any running segments or in-jokes. Great highlights: memorable quotes and hot takes, genuine disagreements, funny tangents, standout stories, and shared laughter.",
    },
    "just-chatting": {
        "display_name": "Just Chatting / IRL",
        "setting": "Talking-to-chat or IRL stream - reactions, Q&A, stories, and community interaction rather than a specific game. Personality carries the session.",
        "your_characters": "",
        "other_characters": "",
        "notes": "Add your handle and any frequent chatters, mods, or guests. Great highlights: genuine reactions, funny stories, community callbacks, spicy takes, and anything worth clipping for social media.",
    },
}

BUILTIN_IDS: frozenset[str] = frozenset(BUILTIN_CONTEXTS)


def _path(project_dir: Path) -> Path:
    return project_dir / ".yuu-clip" / _CONTEXTS_FILE


def load_contexts(project_dir: Path) -> dict:
    p = _path(project_dir)
    if not p.exists():
        return {}
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception as exc:
        _log.error("contexts.json is corrupt and could not be loaded: %s - returning empty set", exc)
        return {}


def seed_builtin_contexts(project_dir: Path) -> None:
    """Write built-in contexts that don't yet exist in the project's contexts.json."""
    existing = load_contexts(project_dir)
    now = datetime.now(timezone.utc).isoformat()
    additions = {
        context_id: {**defaults, "created_at": now, "updated_at": now}
        for context_id, defaults in BUILTIN_CONTEXTS.items()
        if context_id not in existing
    }
    if additions:
        save_contexts(project_dir, {**existing, **additions})


def save_contexts(project_dir: Path, contexts: dict) -> None:
    p = _path(project_dir)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(contexts, indent=2, ensure_ascii=False), encoding="utf-8")


WEIGHT_FIELDS = ("score_funny_weight", "score_dramatic_weight", "score_action_weight")


def extract_context_weights(contexts: dict, context_ids: list[str]) -> dict[str, float | None]:
    """Average per-context score weight overrides across the given context IDs.

    Returns a dict with keys score_funny_weight / score_dramatic_weight / score_action_weight.
    A key is None when no assigned context sets that weight (caller should fall back to global).
    """
    totals: dict[str, list[float]] = {k: [] for k in WEIGHT_FIELDS}
    for cid in context_ids:
        ctx = contexts.get(cid, {})
        for key in WEIGHT_FIELDS:
            val = ctx.get(key)
            if val is not None:
                totals[key].append(float(val))
    return {k: (sum(vs) / len(vs) if vs else None) for k, vs in totals.items()}


def format_context_block(contexts: dict, context_ids: list[str]) -> str:
    """Build the LLM injection block for the given context IDs.

    Returns an empty string when no matching contexts are found.
    """
    blocks: list[str] = []
    for context_id in context_ids:
        ctx = contexts.get(context_id)
        if not ctx:
            continue
        name = ctx.get("display_name", context_id)
        parts = [f"== WORLD CONTEXT: {name} =="]
        for field_key, label in _FIELDS:
            val = ctx.get(field_key, "").strip()
            if val:
                parts.append(f"[{label}] {val}")
        parts.append("== END CONTEXT ==")
        blocks.append("\n".join(parts))
    return "\n\n".join(blocks)
