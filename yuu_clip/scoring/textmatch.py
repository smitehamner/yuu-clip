"""
Text matching shared by hot-word scoring (Plan 03) and sensitive-content scanning
(Plan 06). Handles the "exact", "case_insensitive", and "fuzzy" match modes —
LLM-semantic matching is a separate path (scoring/llm.py) and never goes through
this module.

Also hosts transcript name-correction detection (Plan 09): fuzzy-matching mis-heard
spoken names ("You" → "Yuu") against a lexicon of known names.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional

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


# ── transcript name correction (Plan 09) ──────────────────────────────────────
# Whisper mis-hears spoken names ("You" for "Yuu"). We fuzzy-match transcript
# tokens against a lexicon of *known* names (confirmed speakers + world-context
# characters) and surface a reviewable diff — nothing is auto-applied.
#
# Cutoff design (tuned empirically — the plan's "ratio >= 90 common / >= 80 normal"
# is wrong for the marquee case: fuzz.ratio("you", "yuu") is only 66.7, so a 90
# floor would never catch it). Instead:
#   - Ordinary (long/rare) tokens need a high similarity (>= 80): a big edit
#     distance on a long word is unlikely to be the same name.
#   - Short / common tokens can never clear 80 against a 3-letter name even when
#     they ARE the mis-hearing, so they use a lower floor (>= 65) but must appear
#     Capitalized in context — capitalization is the precision lever a bare
#     similarity score can't provide for short words.
# Precision is further protected by: known-names-only lexicon, own-name exclusion
# (a speaker rarely mis-says their own name), and mandatory per-group review.

_NAME_TOKEN_RE = re.compile(r"[^\W\d_]+", re.UNICODE)  # unicode letters, no digits/underscore
_NAME_RATIO_NORMAL = 80.0
_NAME_RATIO_COMMON = 65.0
_MIN_NAME_LENGTH = 3

# Pure function words: never plausible mis-heard names. Excluded outright so a
# character named e.g. "Thane" / "Ander" doesn't flag every capitalized
# "The" / "And" at a sentence start.
_STOPWORDS = frozenset({
    "the", "a", "an", "and", "or", "but", "if", "of", "to", "in", "on", "at",
    "for", "by", "with", "as", "is", "it", "its", "be", "was", "were", "are",
    "am", "been", "being", "this", "that", "these", "those", "i", "we", "they",
    "he", "she", "him", "her", "them", "his", "hers", "their", "our", "my", "me",
    "us", "your", "yours", "not", "no", "do", "does", "did", "so", "up", "out",
    "off", "then", "than", "too", "very", "just", "can", "will", "would",
})
# Common English words that ARE plausible name mis-hearings ("You" for "Yuu",
# "Mark" / "Jack" / "Rose" as both a word and a name). These, plus any token
# <= 3 characters, use the lower ratio floor and the capitalization gate.
_COMMON_WORDS = frozenset({
    "you", "hey", "see", "may", "well", "mark", "jack", "rose", "dawn", "grace",
    "hope", "joy", "art", "ray", "max", "june", "bill", "jean", "sky", "faith",
})


@dataclass(frozen=True)
class LexiconName:
    """A known name to look for mis-transcriptions of.

    ``owner_speaker_id`` is the Speaker this name belongs to (so their own lines
    are excluded — people rarely mis-say their own name); None for world-context
    character names, which have no owning voice.
    """
    name: str
    owner_speaker_id: Optional[int] = None


@dataclass(frozen=True)
class NameCorrection:
    segment_id: int
    token: str            # the literal mis-heard text as it appears
    token_start: int      # character offset of the token within the segment text
    token_end: int
    suggested: str        # the lexicon name to replace it with
    score: float          # rapidfuzz ratio (0–100)
    speaker_scoped: bool  # True when the segment is attributed (own-name rule applied)
    common_word: bool     # True when the token used the common/short-word cutoff


def _is_common_token(token: str) -> bool:
    return token.casefold() in _COMMON_WORDS or len(token) <= 3


def extract_character_names(text: str) -> list[str]:
    """Capitalized letter-tokens >= 3 chars from world-context character free text.

    Deduplicated case-insensitively, preserving first-seen casing. Used to seed
    the name-correction lexicon from a context's your/other-characters fields.
    """
    seen: dict[str, str] = {}
    for match in _NAME_TOKEN_RE.finditer(text or ""):
        token = match.group()
        if len(token) >= _MIN_NAME_LENGTH and token[0].isupper():
            seen.setdefault(token.casefold(), token)
    return list(seen.values())


def find_name_corrections(segments, lexicon: list[LexiconName]) -> list[NameCorrection]:
    """Find likely mis-transcriptions of known names across transcript *segments*.

    *segments* is any iterable of objects with ``id``, ``text``, and ``speaker_id``.
    Pure and deterministic — the primary test surface for Plan 09. Emits at most one
    correction per token (its best-scoring lexicon name); nothing is applied here.
    """
    names = [(entry.name, entry.owner_speaker_id) for entry in lexicon
             if len(entry.name) >= _MIN_NAME_LENGTH]
    if not names:
        return []
    lexicon_lower = {name.casefold() for name, _ in names}

    corrections: list[NameCorrection] = []
    for segment in segments:
        text = segment.text or ""
        speaker_id = getattr(segment, "speaker_id", None)
        for match in _NAME_TOKEN_RE.finditer(text):
            token = match.group()
            token_lower = token.casefold()
            if token_lower in _STOPWORDS or token_lower in lexicon_lower:
                continue
            common = _is_common_token(token)
            if common and not token[0].isupper():
                continue
            cutoff = _NAME_RATIO_COMMON if common else _NAME_RATIO_NORMAL
            best_name: Optional[str] = None
            best_score = 0.0
            for name, owner_speaker_id in names:
                if owner_speaker_id is not None and owner_speaker_id == speaker_id:
                    continue
                # Short/common words match longer names too loosely at the lower
                # cutoff ("All" vs "Sally"), so require near-equal length there — a
                # genuine one-word mis-hearing barely changes length ("You"/"Yuu").
                if common and abs(len(token) - len(name)) > 1:
                    continue
                score = fuzz.ratio(token_lower, name.casefold())
                if score >= cutoff and score > best_score:
                    best_name, best_score = name, score
            if best_name is None:
                continue
            corrections.append(NameCorrection(
                segment_id=segment.id,
                token=token,
                token_start=match.start(),
                token_end=match.end(),
                suggested=best_name,
                score=round(best_score, 1),
                speaker_scoped=speaker_id is not None,
                common_word=common,
            ))
    return corrections
