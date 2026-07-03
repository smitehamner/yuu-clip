"""
Text matching shared by hot-word scoring (Plan 03) and sensitive-content scanning
(Plan 06). Handles only the "exact" and "case_insensitive" match modes — LLM-semantic
matching is a separate path (scoring/llm.py) and never goes through this module.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

# Transcript excerpts prefix each line with "Name: " — stripped before matching so a
# speaker named e.g. "Fire" can't spuriously match the hot-word "fire".
_SPEAKER_PREFIX_RE = re.compile(r"^[^\n:]{1,40}:\s*", re.MULTILINE)


def strip_speaker_prefixes(text: str) -> str:
    return _SPEAKER_PREFIX_RE.sub("", text)


@dataclass(frozen=True)
class MatchTerm:
    phrase: str
    mode: str  # "exact" | "case_insensitive"


@dataclass(frozen=True)
class Match:
    phrase: str
    mode: str
    count: int


def _phrase_pattern(phrase: str) -> str:
    """Build a word-boundary-aware regex for a (possibly multi-word) phrase.

    Uses (?<!\\w)/(?!\\w) rather than \\b so phrases ending in punctuation (e.g. the
    literal phrase "c++") still get a correct trailing boundary — \\b only fires at a
    word/non-word transition, which a non-word phrase ending followed by a non-word
    character (space, end of string) would fail. Words within the phrase are joined by
    a run of non-word characters so "oh no" also matches "oh, no" or "oh-no".
    """
    words = [re.escape(w) for w in phrase.split()]
    body = r"[^\w]+".join(words)
    return rf"(?<!\w){body}(?!\w)"


def find_matches(text: str, terms: list[MatchTerm]) -> list[Match]:
    """Find each term's occurrences in *text*. Returns one Match per term that occurs
    at least once, with `count` set to the number of occurrences (display-only —
    callers that apply a boost must count a match once per clip regardless of count)."""
    if not text:
        return []
    matches = []
    for term in terms:
        flags = re.IGNORECASE if term.mode == "case_insensitive" else 0
        pattern = re.compile(_phrase_pattern(term.phrase), flags)
        count = len(pattern.findall(text))
        if count:
            matches.append(Match(phrase=term.phrase, mode=term.mode, count=count))
    return matches
