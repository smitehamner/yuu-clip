"""
Safety net for the no-build SPA's global function surface.

The static modules use inline ``onclick="fn()"`` handlers in both ``index.html``
and JS-generated template strings. The browser resolves those handler names in
the *global* scope, so every function referenced by an inline handler must be a
global ``window`` property. If a refactor (e.g. wrapping a module in an IIFE)
makes such a function module-private, the button silently throws a
ReferenceError only when clicked — a flow the targeted UI tests may not cover.

This test extracts every inline-handler function name from the served files and
asserts each is defined as a function on ``window``, turning that latent runtime
break into an immediate, deterministic failure.
"""
from __future__ import annotations

import re
import urllib.request

import pytest
from conftest import LIVE_URL, skip_no_server
from playwright.sync_api import Page


@pytest.fixture
def page(logic_page):
    """Only ``page.evaluate()`` against the served globals — share one
    load-once page (see ``logic_page`` in conftest) instead of a fresh full
    page load."""
    return logic_page

# Every served JS module. Handlers are built in JS template strings across all of
# them, so the extractor must scan the full set — not just the feature files that
# happen to own an inline handler today — or a future handler in an unlisted file
# escapes this net. Keep in sync with the <script> list in index.html.
_JS_MODULES = [
    "state.js", "format.js", "jobs.js", "preview.js", "utils.js",
    "ui.js", "helpmodals.js", "shortcuts.js", "panelnav.js", "videos.js",
    "videos-timeline.js", "videos-summary.js", "videos-runmeta.js",
    "clips.js", "clipbulk.js",
    "clipexport.js", "clipcreate.js", "exporteditor.js", "exportpresets.js",
    "analyze.js", "reel.js", "contexts.js", "settings.js", "settings-previews.js",
    "settings-installs.js", "modelcatalog.js", "split.js",
    "projects.js", "sessions.js", "sounds.js", "speakers.js", "transcript.js",
    "hotwords.js", "namecorrections.js", "sensitive.js", "boot.js",
]

# Identifiers that appear before "(" inside handler bodies but are not app
# functions: JS keywords and the implicit event arg.
_NOT_FUNCTIONS = {
    "if", "for", "while", "switch", "return", "typeof", "void", "new",
    "delete", "function", "else", "do", "try", "catch", "throw", "var",
    "let", "const", "true", "false", "null", "this", "event", "await",
    "in", "of", "instanceof",
}

_HANDLER_RE = re.compile(r'on[a-z]+="([^"]*)"')
# A call to a bare (non-method) identifier: not preceded by "." or a word char.
_CALL_RE = re.compile(r'(?<![.\w])([A-Za-z_]\w*)\s*\(')


def _fetch(path: str) -> str:
    with urllib.request.urlopen(f"{LIVE_URL}/{path}", timeout=5) as resp:
        return resp.read().decode("utf-8")


def _inline_handler_functions() -> set[str]:
    sources = ["static/index.html"] + [f"static/{m}" for m in _JS_MODULES]
    names: set[str] = set()
    for path in sources:
        text = _fetch(path)
        for body in _HANDLER_RE.findall(text):
            for name in _CALL_RE.findall(body):
                if name not in _NOT_FUNCTIONS:
                    names.add(name)
    return names


@skip_no_server
class TestGlobalHandlerSurface:
    def test_inline_handler_functions_are_global(self, page: Page):
        expected = _inline_handler_functions()
        assert expected, "extractor found no inline-handler functions — check selectors"
        missing = page.evaluate(
            "(names) => names.filter(n => typeof window[n] !== 'function')",
            sorted(expected),
        )
        assert not missing, (
            "Inline on*-handlers reference functions that are not global "
            f"(would throw ReferenceError when triggered): {missing}"
        )
