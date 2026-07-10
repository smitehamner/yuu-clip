"""Opt-in live smoke test for the remote (Claude) wire path (WS4 Stage 4).

Excluded from every default run by TWO independent gates, for billing safety:
  1. the `live_remote` marker - pytest.ini's `addopts = -m "not live_remote"` drops it,
  2. `skipif` on ANTHROPIC_API_KEY - it never runs without a key in the environment.

Run it deliberately with a key when you want to verify the real API call:

    YUU_REMOTE_AI=1 ANTHROPIC_API_KEY=sk-ant-... pytest -m live_remote

It makes a single minimal chat() call and only asserts a non-empty string back.
"""
from __future__ import annotations

import os

import pytest

pytestmark = pytest.mark.live_remote


@pytest.mark.skipif(
    not os.environ.get("ANTHROPIC_API_KEY"),
    reason="live_remote smoke test needs ANTHROPIC_API_KEY (and is opt-in)",
)
def test_claude_chat_round_trip_against_real_api():
    from yuu_clip.config import Config
    from yuu_clip.scoring.llm_client import ClaudeClient

    cfg = Config()
    cfg.claude_api_key = os.environ["ANTHROPIC_API_KEY"]
    cfg.claude_model = "claude-haiku-4-5-20251001"  # cheapest; keep the wire call tiny
    reply = ClaudeClient(cfg).chat(
        [{"role": "user", "content": "Reply with the single word: pong"}]
    )
    assert isinstance(reply, str)
    assert reply.strip()
