"""
Scorer protocol and ScoreResult dataclass.

A scorer returns a ScoreResult with a 0-1 value for each dimension it measures,
and None for dimensions it has no opinion on. The ScoringEngine combines results
from multiple scorers using configurable weights, normalising each dimension only
over the scorers that actually emit a value for it.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Protocol

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from yuu_clip.db.models import ClipCandidate


@dataclass
class ScoreResult:
    # None means "this scorer has no opinion on the dimension" - distinct from a
    # real 0.0 ("scored, and it's a zero"). The engine normalises each dimension
    # only over the scorers that emit a value for it, so a scorer that doesn't
    # measure a dimension never drags that dimension's average down.
    score_funny:    float | None = None
    score_dramatic: float | None = None
    score_action:   float | None = None
    score_visual:   float | None = None   # pixel-derived intensity (scene cuts, on-screen activity)
    description: str = ""           # one-sentence summary of what happens in the clip
    description_long: str = ""     # structured paragraph: what/why/who/details
    tags:  list[str]       = field(default_factory=list)
    notes: dict[str, Any]  = field(default_factory=dict)


class Scorer(Protocol):
    name: str
    weight: float  # contribution weight used by ScoringEngine

    def is_available(self) -> bool:
        """Return False if required external deps/services are missing."""
        ...

    def score(self, clip: "ClipCandidate", session: "Session") -> ScoreResult:
        """Return dimension scores for *clip*.  Should never raise."""
        ...
