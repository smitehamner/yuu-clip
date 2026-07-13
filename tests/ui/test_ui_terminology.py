"""
Terminology and display-convention contract (CC-6 / CC-8 / CC-10).

CC-6: user-facing scores always render as percentages - raw 0-1 fractions
never appear. CC-8: user-facing labels say "Recording(s)", never "Video(s)"
(code identifiers keep `video`). CC-10: counts pluralize via the plural()
helper - no "(s)" shorthand in user-facing strings.

Static-file assertions run without a server; behavior tests run against the
live dev server on port 8080. See tests/conftest.py for shared helpers.
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest
from conftest import skip_no_server
from playwright.sync_api import Page, expect


@pytest.fixture
def page(logic_page):
    """These behavior tests only read the DOM / evaluate ``plural()`` - no
    mutation - so they share one load-once page (see ``logic_page`` in conftest)
    instead of paying a fresh full page load per test."""
    return logic_page


STATIC_DIR = Path(__file__).resolve().parents[2] / "yuu_clip" / "web" / "static"
INDEX_HTML = (STATIC_DIR / "index.html").read_text(encoding="utf-8")
VIDEOS_JS = (STATIC_DIR / "videos.js").read_text(encoding="utf-8")

PARENTHETICAL_PLURAL = re.compile(
    r"\b(clip|segment|track|player|video|recording|error|file|entr\w*)\(s\)",
    re.IGNORECASE,
)


def test_no_parenthetical_plurals_in_static_files():
    offenders = [
        f"{path.name}: {match.group(0)}"
        for path in sorted(STATIC_DIR.iterdir())
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


@skip_no_server
class TestPluralHelper:
    def _plural(self, page: Page, args: list) -> str:
        return page.evaluate("(args) => plural(...args)", args)

    def test_singular(self, page: Page):
        assert self._plural(page, [1, "clip"]) == "1 clip"

    def test_plural(self, page: Page):
        assert self._plural(page, [3, "clip"]) == "3 clips"

    def test_zero_is_plural(self, page: Page):
        assert self._plural(page, [0, "clip"]) == "0 clips"

    def test_irregular_plural_form(self, page: Page):
        assert self._plural(page, [2, "entry", "entries"]) == "2 entries"

    def test_multiword_noun(self, page: Page):
        assert self._plural(page, [2, "audio track"]) == "2 audio tracks"


@skip_no_server
def test_sidebar_heading_reads_recordings(page: Page):
    heading = page.locator(".videos-group .clips-section-header .section-toggle-btn").first
    expect(heading).to_have_text("Recordings")


# ---------------------------------------------------------------------------
# M3-4 / L5-1: the speech-to-text model select is one concept everywhere -
# identical option copy across all five surfaces, "Caption model" label and
# large-v3 default on the three export/retranscribe surfaces.
# ---------------------------------------------------------------------------

CANONICAL_MODEL_OPTIONS = {
    "tiny": "tiny - fastest, lowest quality",
    "base": "base - fast, lower quality",
    "small": "small - fast, decent quality (~500 MB VRAM)",
    "medium": "medium - good balance (~1.5 GB VRAM)",
    "large-v3": "large-v3 - best quality (~3 GB VRAM)",
}

MODEL_SELECT_IDS = [
    "s-whisper-model",            # Settings
    "analyze-model",              # New Recording panel
    "batch-retranscribe-model",   # Batch Export modal
    "retranscribe-model",         # Retranscribe Clip modal
    "export-retranscribe-model",  # Export Clip modal
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


@pytest.mark.parametrize(
    "select_id",
    ["batch-retranscribe-model", "retranscribe-model", "export-retranscribe-model"],
)
def test_export_surface_model_default_is_large_v3(select_id: str):
    selected = [value for value, attrs, _ in _select_options(select_id) if "selected" in attrs]
    assert selected == ["large-v3"]


@pytest.mark.parametrize(
    "select_id",
    ["batch-retranscribe-model", "retranscribe-model", "export-retranscribe-model"],
)
def test_export_surface_model_label_is_caption_model(select_id: str):
    label = re.search(rf'<label for="{select_id}"[^>]*>([^<]*)</label>', INDEX_HTML)
    assert label, f"no <label for=\"{select_id}\"> in index.html"
    assert label.group(1).strip() == "Caption model"
