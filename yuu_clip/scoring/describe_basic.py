"""
Basic description — a template one-liner built from data already on a clip, so a
clip is never left blank when no language model is available (Stage 02).

It combines three cheap signals: the speaker names present in the clip's transcript
excerpt, the top keywords (reusing the similarity engine's token extraction), and the
leading score dimension. An LLM description always supersedes it (the scoring engine
only fills this in when no scorer emitted a description), and a creator edit
(``description_user``) wins over both.
"""
from __future__ import annotations

import re
from typing import TYPE_CHECKING

from yuu_clip.scoring.similarity import top_keywords

if TYPE_CHECKING:
    from yuu_clip.db.models import ClipCandidate

# Transcript excerpts prefix each line with "Name: " — the same shape textmatch
# strips before matching. Captured here to read the speaker names back out.
_SPEAKER_PREFIX_RE = re.compile(r"^([^\n:]{1,40}):\s", re.MULTILINE)

_MAX_SPEAKERS = 3
_MAX_KEYWORDS = 3
# A dimension only earns a mention when it clears this — below it, the signal is too
# weak to characterize the clip and would just add noise.
_DIMENSION_FLOOR = 0.34

_DIMENSION_LABELS = (
    ("action", "action"),
    ("dramatic", "drama"),
    ("funny", "comedy"),
)


def _speaker_names(excerpt: str) -> list[str]:
    """Unique speaker names from the excerpt's line prefixes, in first-seen order.

    A bare 'Speaker N' label carries no real name, so those are dropped — naming the
    anonymous index adds nothing a reader wants."""
    names: list[str] = []
    for raw in _SPEAKER_PREFIX_RE.findall(excerpt):
        name = raw.strip()
        if not name or re.fullmatch(r"[Ss]peaker\s*\d+", name):
            continue
        if name not in names:
            names.append(name)
    return names


def _join_names(names: list[str]) -> str:
    capped = names[:_MAX_SPEAKERS]
    if len(capped) <= 1:
        return capped[0] if capped else ""
    return " & ".join([", ".join(capped[:-1]), capped[-1]])


def _leading_dimension(clip: "ClipCandidate") -> str:
    scores = {
        "action": clip.score_action or 0.0,
        "dramatic": clip.score_dramatic or 0.0,
        "funny": clip.score_funny or 0.0,
    }
    best_dim, best_score = max(scores.items(), key=lambda kv: kv[1])
    if best_score < _DIMENSION_FLOOR:
        return ""
    label = next(label for dim, label in _DIMENSION_LABELS if dim == best_dim)
    band = "high" if best_score >= 0.66 else "some"
    return f"{band} {label}"


def build_basic_description(clip: "ClipCandidate") -> tuple[str, str]:
    """Build a template ``(description, description_long)`` for *clip*.

    ``description_long`` is always empty — a paragraph is what an LLM adds. Returns
    ``("", "")`` when the excerpt has no usable content (nothing worth showing)."""
    excerpt = (clip.transcript_excerpt or "").strip()
    if not excerpt:
        return "", ""

    from yuu_clip.scoring.textmatch import strip_speaker_prefixes

    speakers = _join_names(_speaker_names(excerpt))
    keywords = ", ".join(top_keywords(strip_speaker_prefixes(excerpt), _MAX_KEYWORDS))
    dimension = _leading_dimension(clip)

    lead = " — ".join(part for part in (speakers, keywords) if part)
    if lead and dimension:
        return f"{lead} · {dimension}", ""
    if lead:
        return lead, ""
    if dimension:
        return dimension[0].upper() + dimension[1:], ""
    return "", ""
