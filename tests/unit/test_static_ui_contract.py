"""Static-file UI contracts - terminology, percentage display, model-select copy.

These assert on the committed static files (`index.html`, `videos.js`, `app.css`)
with no browser and no live server, so they live in the unit tier rather than the
Playwright `tests/ui/` suite where they used to pay the ~1.5s-per-test live-server
setup for nothing. The behavior halves that genuinely need a rendered page stay in
`tests/ui/test_ui_terminology.py`.

CC-6: user-facing scores render as percentages - raw 0-1 fractions never appear.
CC-8: user-facing labels say "Recording(s)", never "Video(s)" (code keeps `video`).
CC-10: counts pluralize via plural() - no "(s)" shorthand in user-facing strings.
L4-3: the Scoring/Actions two-card row wraps on narrow layouts.
M3-4 / L5-1: the speech-to-text model select is one concept everywhere - identical
option copy across all six surfaces, "Caption model" label on the three
export/retranscribe surfaces, and a static large-v3 default on the standalone
Retranscribe Clip modal (the export-time pickers are driven by the
export_retranscribe_model setting instead - see B20).
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest

from yuu_clip.whisper_catalog import WHISPER_UI_MODELS

STATIC_DIR = Path(__file__).resolve().parents[2] / "yuu_clip" / "web" / "static"
INDEX_HTML = (STATIC_DIR / "index.html").read_text(encoding="utf-8")
VIDEOS_JS = (STATIC_DIR / "videos" / "videos.js").read_text(encoding="utf-8")
APP_CSS = (STATIC_DIR / "app.css").read_text(encoding="utf-8")

PARENTHETICAL_PLURAL = re.compile(
    r"\b(clip|segment|track|player|video|recording|error|file|entr\w*)\(s\)",
    re.IGNORECASE,
)


def test_no_parenthetical_plurals_in_static_files():
    offenders = [
        f"{path.name}: {match.group(0)}"
        for path in sorted(STATIC_DIR.rglob("*"))
        if path.suffix in {".js", ".html"}
        for match in PARENTHETICAL_PLURAL.finditer(path.read_text(encoding="utf-8"))
    ]
    assert offenders == []


@pytest.mark.parametrize(
    "forbidden",
    [
        ">Videos<",
        'aria-label="Sort videos by"',
        'placeholder="Search videos',
        'aria-label="Search videos"',
        'aria-label="Video filters"',
        "Videos with clip scoring errors",
        "Videos / Clips",
    ],
)
def test_index_html_sidebar_says_recordings_not_videos(forbidden: str):
    assert forbidden not in INDEX_HTML


def test_index_html_sidebar_recording_labels_present():
    assert ">Recordings<" in INDEX_HTML
    assert 'aria-label="Sort recordings by"' in INDEX_HTML
    assert 'placeholder="Search recordings' in INDEX_HTML


def test_score_override_slider_labels_are_percentages():
    assert "<span>0.00</span>" not in INDEX_HTML
    assert "<span>1.00</span>" not in INDEX_HTML
    assert "<span>0%</span><span>100%</span>" in INDEX_HTML


def test_videos_js_recording_terms():
    assert "video file first" not in VIDEOS_JS
    assert "Select a valid recording file first" in VIDEOS_JS
    assert "&#127916; Video<" not in VIDEOS_JS
    assert "&#127916; Recording<" in VIDEOS_JS


def test_sidebar_score_range_is_percentage():
    assert "score_min.toFixed" not in VIDEOS_JS
    assert "score_max.toFixed" not in VIDEOS_JS


def test_detail_cards_row_wraps():
    """L4-3: the Scoring/Actions two-card row must wrap on narrow layouts."""
    row_rule = re.search(r"\.detail-cards-row\s*\{([^}]*)\}", APP_CSS)
    assert row_rule and "flex-wrap: wrap" in row_rule.group(1)


# ---------------------------------------------------------------------------
# M3-4 / L5-1: the speech-to-text model select copy is sourced from
# yuu_clip/whisper_catalog.py (the single Python source of truth that
# `yuu-dev shared-data` bakes into catalog-data.json). The web <option> lists
# must match it exactly, so a copy change flows from one place.
# ---------------------------------------------------------------------------

CANONICAL_MODEL_OPTIONS = {m.id: m.option_text() for m in WHISPER_UI_MODELS}

MODEL_SELECT_IDS = [
    "s-whisper-model",              # Settings - analyze-time transcription model
    "s-export-retranscribe-model",  # Settings - export-time retranscription model (B20)
    "analyze-model",                # New Recording panel
    "batch-retranscribe-model",     # Batch Export modal
    "retranscribe-model",           # Retranscribe Clip modal
    "export-retranscribe-model",    # Export Clip modal
]


def _select_options(select_id: str) -> list[tuple[str, str, str]]:
    select = re.search(
        rf'<select[^>]*id="{select_id}"[^>]*>(.*?)</select>', INDEX_HTML, re.DOTALL
    )
    assert select, f"select #{select_id} not found in index.html"
    return re.findall(r'<option value="([^"]*)"([^>]*)>\s*([^<]*?)\s*</option>', select.group(1))


@pytest.mark.parametrize("select_id", MODEL_SELECT_IDS)
def test_model_select_option_copy_is_canonical(select_id: str):
    options = {value: text for value, _, text in _select_options(select_id)}
    assert options == CANONICAL_MODEL_OPTIONS


def test_retranscribe_clip_model_default_is_large_v3():
    # Only the standalone Retranscribe Clip modal keeps a static HTML default -
    # batch-retranscribe-model and export-retranscribe-model are now driven by
    # the export_retranscribe_model setting at modal-open time (B20), so their
    # <option> markup carries no "selected" for a static-file test to see.
    selected = [value for value, attrs, _ in _select_options("retranscribe-model") if "selected" in attrs]
    assert selected == ["large-v3"]


@pytest.mark.parametrize(
    "select_id",
    ["batch-retranscribe-model", "retranscribe-model", "export-retranscribe-model"],
)
def test_export_surface_model_label_is_caption_model(select_id: str):
    label = re.search(rf'<label for="{select_id}"[^>]*>([^<]*)</label>', INDEX_HTML)
    assert label, f"no <label for=\"{select_id}\"> in index.html"
    assert label.group(1).strip() == "Caption model"
