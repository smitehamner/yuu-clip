"""Fact-drift guards binding the most-burned doc claims to code truth.

Cheap, offline, exact-match scanners (unit tier) that fail when a volatile fact
drifts out of sync between the code and the surfaces that state it. The full list of
volatile claims and every surface each appears on lives in
``docs/dev/llm/DOC-CLAIMS.md``; these tests cover the subset that has actually gone
stale before. Keep them blunt and deterministic - a phrase check, not a fuzzy parse.

WS-F's generated shared-data drift test will subsume the recommended-model-size check.
"""
from __future__ import annotations

import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
INDEX_HTML = REPO / "yuu_clip" / "web" / "static" / "index.html"
SETUP_HTML = REPO / "electron" / "setup.html"
README = REPO / "README.md"
DEV_README = REPO / "DEV-README.md"
DOCS_USER = REPO / "docs" / "user"

AXES = ("Funny", "Dramatic", "Action", "Visual")


def _getting_started_modal(html: str) -> str:
    start = html.index('id="getting-started-modal"')
    end = html.index("getting-started-close-btn", start)
    return html[start:end]


def test_getting_started_modal_names_all_four_axes():
    modal = _getting_started_modal(INDEX_HTML.read_text(encoding="utf-8"))
    missing = [axis for axis in AXES if axis not in modal]
    assert missing == [], f"Getting Started modal is missing axis names: {missing}"


_STALE_SCORING_PHRASES = ("transcripts, not video", "reads transcripts, not")


def test_docs_user_do_not_claim_scoring_reads_transcripts_not_video():
    """The Visual axis reads the picture, so 'the scoring reads transcripts, not
    video' is false and must not reappear in any user-facing doc."""
    offenders = [
        f"{md.relative_to(REPO)}: {phrase}"
        for md in sorted(DOCS_USER.rglob("*.md"))
        for phrase in _STALE_SCORING_PHRASES
        if phrase in md.read_text(encoding="utf-8").lower()
    ]
    assert offenders == [], f"stale scoring claim (Visual reads video now): {offenders}"


def _whisper_models_table(text: str) -> str:
    start = text.index("## Whisper models")
    rest = text[start + len("## Whisper models"):]
    nxt = rest.find("\n## ")
    return rest if nxt == -1 else rest[:nxt]


def test_dev_readme_default_whisper_model_matches_config_default():
    from yuu_clip.config import Config

    default = Config().whisper_model
    table = _whisper_models_table(DEV_README.read_text(encoding="utf-8"))
    default_rows = [
        line for line in table.splitlines()
        if line.strip().startswith("|") and "Default" in line
    ]
    assert len(default_rows) == 1, (
        f"expected exactly one Whisper row marked Default, found {len(default_rows)}"
    )
    model_cell = default_rows[0].split("|")[1].strip()
    assert model_cell == default, (
        f"DEV-README marks {model_cell!r} as the default Whisper model, "
        f"but Config default is {default!r}"
    )


def test_recommended_model_size_matches_catalog_in_readme_and_wizard():
    from yuu_clip import model_catalog as mc

    top_text_model = mc.text_models()[0]  # the recommended model README + wizard cite
    size_str = f"{top_text_model.size_gb} GB"
    for path in (README, SETUP_HTML):
        assert size_str in path.read_text(encoding="utf-8"), (
            f"{path.name} does not state the recommended model size {size_str!r} "
            f"(from model_catalog {top_text_model.id})"
        )


# Glossary-banned code terms must not surface in user-facing prose (CLAUDE.md
# terminology rules). User docs say "analyze/analysis", "inspect", "track layout".
_BANNED_TERM_RE = re.compile(
    r"\b(ingest|ingests|ingesting|ingested"
    r"|probe|probes|probing|probed"
    r"|profile|profiles|profiling)\b",
    re.IGNORECASE,
)
# Add legitimate exceptions here as "<filename>: <matched word>" if one ever arises.
_ALLOWED: set[str] = set()


def test_docs_user_prose_avoids_glossary_banned_terms():
    offenders = {
        f"{md.relative_to(REPO)}: {match.group(0)}"
        for md in sorted(DOCS_USER.rglob("*.md"))
        for match in _BANNED_TERM_RE.finditer(md.read_text(encoding="utf-8"))
    }
    assert offenders - _ALLOWED == set(), (
        f"glossary-banned code terms in user docs (use the glossary term): "
        f"{sorted(offenders - _ALLOWED)}"
    )
