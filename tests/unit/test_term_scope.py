"""Context-scoping filter for hot-words / sensitive terms (WS3).

Pure filter logic - no DB, no server. Terms and videos are lightweight stand-ins
with just the attributes ``terms_for_video`` reads (``context_slug`` /
``context_names_json``), matching the duck-typed contract in term_scope.py.
"""
from __future__ import annotations

import json
from types import SimpleNamespace

from yuu_clip.scoring.term_scope import terms_for_video, video_context_ids


def _term(slug):
    return SimpleNamespace(context_slug=slug)


def _video(context_ids):
    return SimpleNamespace(context_names_json=json.dumps(context_ids) if context_ids is not None else None)


class TestVideoContextIds:
    def test_none_video_is_empty(self):
        assert video_context_ids(None) == set()

    def test_missing_json_is_empty(self):
        assert video_context_ids(_video(None)) == set()

    def test_empty_list_is_empty(self):
        assert video_context_ids(_video([])) == set()

    def test_returns_the_tagged_ids(self):
        assert video_context_ids(_video(["fantasy-rp", "mmo-rp"])) == {"fantasy-rp", "mmo-rp"}

    def test_malformed_json_is_empty_not_crash(self):
        assert video_context_ids(SimpleNamespace(context_names_json="{not json")) == set()

    def test_non_list_json_is_empty(self):
        assert video_context_ids(SimpleNamespace(context_names_json='{"a": 1}')) == set()


class TestTermsForVideo:
    def test_global_term_always_included(self):
        terms = [_term(None)]
        assert terms_for_video(terms, _video([])) == terms
        assert terms_for_video(terms, _video(["fantasy-rp"])) == terms
        assert terms_for_video(terms, None) == terms

    def test_context_term_included_only_for_matching_video(self):
        fantasy = _term("fantasy-rp")
        assert terms_for_video([fantasy], _video(["fantasy-rp"])) == [fantasy]
        assert terms_for_video([fantasy], _video(["multiplayer-shooter"])) == []

    def test_term_for_unrelated_context_excluded(self):
        shooter = _term("multiplayer-shooter")
        assert terms_for_video([shooter], _video(["fantasy-rp"])) == []

    def test_union_across_multiple_video_contexts(self):
        # A term matches if its slug is in ANY of the video's contexts (union).
        fantasy = _term("fantasy-rp")
        shooter = _term("multiplayer-shooter")
        result = terms_for_video([fantasy, shooter], _video(["fantasy-rp", "horror-game"]))
        assert result == [fantasy]

    def test_global_and_context_terms_mix(self):
        glob = _term(None)
        fantasy = _term("fantasy-rp")
        shooter = _term("multiplayer-shooter")
        result = terms_for_video([glob, fantasy, shooter], _video(["fantasy-rp"]))
        assert result == [glob, fantasy]

    def test_orphaned_term_treated_as_non_matching(self):
        # A term scoped to a deleted context never appears in any video's context set,
        # so it is excluded everywhere without crashing.
        orphan = _term("deleted-context")
        assert terms_for_video([orphan], _video(["fantasy-rp"])) == []
        assert terms_for_video([orphan], _video([])) == []

    def test_global_only_video_excludes_all_context_terms(self):
        glob = _term(None)
        fantasy = _term("fantasy-rp")
        assert terms_for_video([glob, fantasy], _video(None)) == [glob]
