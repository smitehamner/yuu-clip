"""Unit tests - pre-flight LLM availability warning.

When LLM scoring is requested but the backend isn't reachable, the pipeline should
warn up front (before the slow transcription) so the user can start the LLM engine,
rather than silently producing clips ranked without the AI score.
"""
from __future__ import annotations

import pytest

from yuu_clip import config as config_mod
from yuu_clip.pipeline import ingest as _pipeline
from yuu_clip.pipeline.ingest import AnalyzeOptions


def _config(**overrides) -> config_mod.Config:
    return config_mod.Config(**overrides)


def test_warns_when_llm_wanted_but_unreachable(monkeypatch, capsys):
    monkeypatch.setattr(
        _pipeline, "_llm_unavailable_notice",
        lambda reason: print(f"NOTICE::{reason}"),
    )
    monkeypatch.setattr(
        "yuu_clip.scoring.llm.check_llm_available",
        lambda _cfg: (False, "llama-server was not found"),
    )

    _pipeline._preflight_llm_check(_config(llm_enabled=True), AnalyzeOptions())

    assert "NOTICE::llama-server was not found" in capsys.readouterr().out


def test_silent_when_scoring_disabled_for_run(monkeypatch, capsys):
    called = False

    def _boom(_cfg):
        nonlocal called
        called = True
        return (False, "unreachable")

    monkeypatch.setattr("yuu_clip.scoring.llm.check_llm_available", _boom)

    _pipeline._preflight_llm_check(_config(llm_enabled=True), AnalyzeOptions(no_score=True))

    assert called is False  # availability is never probed when the run skips scoring
    assert capsys.readouterr().out == ""


def test_silent_when_llm_disabled_in_settings(monkeypatch, capsys):
    monkeypatch.setattr(
        "yuu_clip.scoring.llm.check_llm_available",
        lambda _cfg: pytest.fail("should not probe when llm_enabled is False"),
    )

    _pipeline._preflight_llm_check(_config(llm_enabled=False), AnalyzeOptions())

    assert capsys.readouterr().out == ""


def test_silent_when_llm_available(monkeypatch, capsys):
    monkeypatch.setattr(
        _pipeline, "_llm_unavailable_notice",
        lambda reason: pytest.fail("should not warn when the LLM is reachable"),
    )
    monkeypatch.setattr(
        "yuu_clip.scoring.llm.check_llm_available", lambda _cfg: (True, "")
    )

    _pipeline._preflight_llm_check(_config(llm_enabled=True), AnalyzeOptions())

    assert capsys.readouterr().out == ""
