"""
Text matching shared by hot-word scoring (Plan 03) and sensitive-content scanning
(Plan 06). Handles the "exact", "case_insensitive", and "fuzzy" match modes —
LLM-semantic matching is a separate path (scoring/llm.py) and never goes through
this module.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from rapidfuzz import fuzz

# Transcript excerpts prefix each line with "Name: " — stripped before matching so a
# speaker named e.g. "Fire" can't spuriously match the hot-word "fire".
_SPEAKER_PREFIX_RE = re.compile(r"^[^\n:]{1,40}:\s*", re.MULTILINE)

# Fuzzy mode (rapidfuzz partial_ratio) — locked decisions from roadmap plan 06.
FUZZY_MATCH_THRESHOLD = 85
FUZZY_MIN_TERM_LENGTH = 4


def strip_speaker_prefixes(text: str) -> str:
    return _SPEAKER_PREFIX_RE.sub("", text)


@dataclass(frozen=True)
class MatchTerm:
    phrase: str
    mode: str  # "exact" | "case_insensitive" | "fuzzy"


@dataclass(frozen=True)
class Match:
    phrase: str
    mode: str
    count: int
    # Only set by fuzzy matches — the actual text that tripped the match (e.g.
    # "Jonh" for term "John"), so the user can see *what* matched, not just that
    # something did. Exact/case-insensitive matches leave this None; the phrase
    # itself is what was found.
    matched_text: str | None = None


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


def find_fuzzy_matches(
    text: str, terms: list[MatchTerm], threshold: int = FUZZY_MATCH_THRESHOLD,
) -> list[Match]:
    """Find near-spelling occurrences of each fuzzy term in *text*.

    Slides a window of *term*'s word-count across *text*'s words and scores each
    window against the term with rapidfuzz's `partial_ratio` (case-folded).
    Terms shorter than `FUZZY_MIN_TERM_LENGTH` are skipped — callers (the
    sensitive-terms CRUD route) reject these before they ever reach here, but this
    is a defensive backstop against noisy single/double-character matches.

    A hit consumes the rest of its window before scanning resumes, so a single
    occurrence can't be counted twice by two overlapping windows that both clear
    the threshold (e.g. "wallaby way is" scoring high right next to the true
    "42 wallaby way" hit). `matched_text` on the returned Match is the first
    occurrence's literal text, for display ("Jonh" for term "John").
    """
    if not text:
        return []
    # \w+ tokens rather than a plain whitespace split, so a word followed by
    # punctuation ("Jonh,") doesn't leak the comma into the comparison or into
    # the displayed matched_text.
    words = re.findall(r"[\w']+", text)
    matches = []
    for term in terms:
        if len(term.phrase) < FUZZY_MIN_TERM_LENGTH:
            continue
        term_words = term.phrase.split()
        window_len = len(term_words)
        term_folded = term.phrase.casefold()
        hits = []
        i = 0
        while i <= len(words) - window_len:
            window_text = " ".join(words[i:i + window_len])
            score = fuzz.partial_ratio(term_folded, window_text.casefold())
            if score >= threshold:
                hits.append(window_text)
                i += window_len
            else:
                i += 1
        if hits:
            matches.append(Match(phrase=term.phrase, mode="fuzzy", count=len(hits), matched_text=hits[0]))
    return matches
