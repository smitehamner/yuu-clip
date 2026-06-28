"""
Scorer protocol and ScoreResult dataclass.

Every scorer returns a ScoreResult with 0–1 values for each dimension.
The ScoringEngine combines results from multiple scorers using configurable weights.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Protocol

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from yuu_clip.db.models import ClipCandidate


@dataclass
class ScoreResult:
    score_funny:    float = 0.0
    score_dramatic: float = 0.0
    score_action:   float = 0.0
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
