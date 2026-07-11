"""
Clips-vs-Scenes Stage 2: scene scoring through the engine and the rescore route.

The per-clip rescore route (/api/clips/{id}/rescore) serves both kinds - the engine
picks the scorer set by the row's kind. These tests pin: a scene rescore uses the
scene prompt (not the clip prompt) and lands scores; a clip rescore is unchanged;
and a scene with the LLM backend off falls back to the basic-description template.
"""
from __future__ import annotations

import json

from yuu_clip.config import Config
from yuu_clip.db.models import ClipCandidate, make_session
from yuu_clip.scoring.engine import ScoringEngine

_CLIP_MARKER = "You analyze video clips for highlight potential"
_SCENE_MARKER = "You analyze longer video scenes"


def _add_row(project_dir, video_id, kind, excerpt):
    session = make_session(project_dir / ".yuu-clip" / "project.db")
    row = ClipCandidate(
        video_id=video_id, start_ms=0, end_ms=120_000, kind=kind,
        transcript_excerpt=excerpt,
    )
    session.add(row)
    session.commit()
    row_id = row.id
    session.close()
    return row_id


class _FakeClient:
    """Stand-in LLM client: always available, records each call's system prompt,
    returns a fixed scoring payload."""

    def __init__(self, sink):
        self._sink = sink

    def available(self):
        return (True, "")

    def chat(self, messages, temperature=0.1):
        self._sink.append(messages[0]["content"])
        return json.dumps({
            "score_funny": 0.2, "score_dramatic": 0.7, "score_action": 0.1,
            "description": "A tense standoff", "description_long": "It builds and pays off.",
        })


class TestSceneBasicDescriptionFallback:
    def test_scene_llm_off_falls_back_to_basic_description(self):
        # No scene scorers available (the LLM-off case): the scene must still get a
        # template description and be marked scored, mirroring the clip fallback.
        scene = ClipCandidate(
            video_id=1, start_ms=0, end_ms=120_000, kind="scene",
            transcript_excerpt="Yuu: we pulled off the heist",
        )
        ScoringEngine(Config(), scorers=[], scene_scorers=[]).score_clip(scene, None)
        assert scene.description
        assert "heist" in scene.description
        assert "desc_basic" in scene.tags
        assert "llm_no_transcript" not in scene.tags
        assert scene.scored_at is not None

    def test_empty_scene_llm_off_scored_without_transcript_tag(self):
        scene = ClipCandidate(video_id=1, start_ms=0, end_ms=120_000, kind="scene")
        ScoringEngine(Config(), scorers=[], scene_scorers=[]).score_clip(scene, None)
        assert "llm_no_transcript" not in scene.tags
        assert scene.scored_at is not None


class TestRescoreRouteByKind:
    def _patch_client(self, monkeypatch):
        sink: list[str] = []
        monkeypatch.setattr(
            "yuu_clip.scoring.llm.make_client", lambda config: _FakeClient(sink)
        )
        return sink

    def test_rescore_scene_uses_scene_prompt(self, client, project_dir, monkeypatch):
        sink = self._patch_client(monkeypatch)
        vid_id = client.get("/api/videos").json()[0]["id"]
        scene_id = _add_row(project_dir, vid_id, "scene", "a long quiet arc that finally pays off")

        r = client.get(f"/api/clips/{scene_id}/rescore")
        assert r.status_code == 200
        assert "__DONE__" in r.text

        assert any(_SCENE_MARKER in s for s in sink)
        assert all(_CLIP_MARKER not in s for s in sink)

        rows = client.get(f"/api/videos/{vid_id}/clips?kind=scene").json()
        row = next(row for row in rows if row["id"] == scene_id)
        assert "llm_scored" in row["tags"]
        assert row["score_dramatic"] > 0.0

    def test_rescore_clip_uses_clip_prompt(self, client, project_dir, monkeypatch):
        sink = self._patch_client(monkeypatch)
        vid_id = client.get("/api/videos").json()[0]["id"]
        clip_id = _add_row(project_dir, vid_id, "clip", "go go go, that was insane")

        r = client.get(f"/api/clips/{clip_id}/rescore")
        assert r.status_code == 200
        assert "__DONE__" in r.text

        assert any(_CLIP_MARKER in s for s in sink)
        assert all(_SCENE_MARKER not in s for s in sink)

        rows = client.get(f"/api/videos/{vid_id}/clips?kind=clip").json()
        row = next(row for row in rows if row["id"] == clip_id)
        assert "llm_scored" in row["tags"]
