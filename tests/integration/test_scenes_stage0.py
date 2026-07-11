"""
Clips-vs-Scenes Stage 0: the shared ClipCandidate table + `kind` discriminator.

Covers the guarded kind-blind paths (the core risk of the shared table): manual
scene creation via the reused picker route, the `kind` list filter, `kind` in the
serialized payload, `_clear_existing_clips` scoped so a clip re-window leaves
scenes intact, and `score_video(kind=...)` running the scorers over one kind only.
"""
from __future__ import annotations

from datetime import datetime, timezone

from yuu_clip.db.models import ClipCandidate, Video, make_session
from yuu_clip.pipeline.ingest import _clear_existing_clips
from yuu_clip.scoring.engine import ScoringEngine


def _db(project_dir):
    return make_session(project_dir / ".yuu-clip" / "project.db")


def _add_scene(project_dir, video_id: int, start_ms: int = 0, end_ms: int = 120_000) -> int:
    session = _db(project_dir)
    scene = ClipCandidate(video_id=video_id, start_ms=start_ms, end_ms=end_ms, kind="scene")
    session.add(scene)
    session.commit()
    scene_id = scene.id
    session.close()
    return scene_id


class TestManualSceneCreate:
    def test_creates_scene_row_with_kind(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        r = client.post(f"/api/videos/{vid_id}/clips", json={"start_ms": 0, "end_ms": 120_000, "kind": "scene"})
        assert r.status_code == 200
        body = r.json()
        assert body["kind"] == "scene"
        assert body["tags"] == ["manual"]
        assert body["status"] == "pending"

    def test_kind_defaults_to_clip_when_omitted(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        r = client.post(f"/api/videos/{vid_id}/clips", json={"start_ms": 0, "end_ms": 10_000})
        assert r.status_code == 200
        assert r.json()["kind"] == "clip"

    def test_rejects_unknown_kind(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        r = client.post(f"/api/videos/{vid_id}/clips", json={"start_ms": 0, "end_ms": 10_000, "kind": "bogus"})
        assert r.status_code == 400


class TestListClipsKindFilter:
    def test_kind_scene_returns_only_scenes(self, client, project_dir):
        vid_id = client.get("/api/videos").json()[0]["id"]
        scene_id = _add_scene(project_dir, vid_id)
        rows = client.get(f"/api/videos/{vid_id}/clips?kind=scene").json()
        assert [r["id"] for r in rows] == [scene_id]
        assert all(r["kind"] == "scene" for r in rows)

    def test_kind_clip_excludes_scenes(self, client, project_dir):
        vid_id = client.get("/api/videos").json()[0]["id"]
        scene_id = _add_scene(project_dir, vid_id)
        rows = client.get(f"/api/videos/{vid_id}/clips?kind=clip").json()
        assert scene_id not in [r["id"] for r in rows]
        assert all(r["kind"] == "clip" for r in rows)
        assert len(rows) == 3  # the three seeded clips

    def test_no_kind_param_returns_all_kinds(self, client, project_dir):
        vid_id = client.get("/api/videos").json()[0]["id"]
        _add_scene(project_dir, vid_id)
        rows = client.get(f"/api/videos/{vid_id}/clips").json()
        kinds = {r["kind"] for r in rows}
        assert kinds == {"clip", "scene"}
        assert len(rows) == 4


class TestClearExistingClipsScopedByKind:
    def test_clear_clips_leaves_scenes_intact(self, project_dir):
        session = _db(project_dir)
        video = session.query(Video).first()
        scene = ClipCandidate(video_id=video.id, start_ms=0, end_ms=120_000, kind="scene")
        session.add(scene)
        session.commit()
        scene_id = scene.id

        deleted = _clear_existing_clips(session, video.id)
        session.commit()

        assert deleted == 3  # only the three seeded clips
        remaining = session.query(ClipCandidate).filter_by(video_id=video.id).all()
        assert [c.id for c in remaining] == [scene_id]
        assert remaining[0].kind == "scene"
        session.close()

    def test_clear_scenes_leaves_clips_intact(self, project_dir):
        session = _db(project_dir)
        video = session.query(Video).first()
        session.add(ClipCandidate(video_id=video.id, start_ms=0, end_ms=120_000, kind="scene"))
        session.commit()

        deleted = _clear_existing_clips(session, video.id, kind="scene")
        session.commit()

        assert deleted == 1
        remaining = session.query(ClipCandidate).filter_by(video_id=video.id).all()
        assert len(remaining) == 3
        assert {c.kind for c in remaining} == {"clip"}
        session.close()


class TestScoreVideoKindGuard:
    def _engine(self):
        from yuu_clip.config import Config
        return ScoringEngine(Config(), scorers=[])

    def _run(self, project_dir, kind, monkeypatch):
        scored_ids: list[int] = []

        def _fake_score_clip(self, clip, session):
            scored_ids.append(clip.id)
            clip.scored_at = datetime.now(timezone.utc)

        monkeypatch.setattr(ScoringEngine, "score_clip", _fake_score_clip)

        session = _db(project_dir)
        video = session.query(Video).first()
        scene = ClipCandidate(video_id=video.id, start_ms=0, end_ms=120_000, kind="scene")
        session.add(scene)
        session.commit()
        scene_id = scene.id
        clip_ids = [c.id for c in session.query(ClipCandidate).filter_by(video_id=video.id, kind="clip")]

        count = self._engine().score_video(video, session, kind=kind)
        session.close()
        return scored_ids, count, clip_ids, scene_id

    def test_default_kind_clip_skips_scenes(self, project_dir, monkeypatch):
        scored_ids, count, clip_ids, scene_id = self._run(project_dir, "clip", monkeypatch)
        assert count == 3
        assert set(scored_ids) == set(clip_ids)
        assert scene_id not in scored_ids

    def test_kind_scene_scores_only_scenes(self, project_dir, monkeypatch):
        scored_ids, count, clip_ids, scene_id = self._run(project_dir, "scene", monkeypatch)
        assert count == 1
        assert scored_ids == [scene_id]
        assert not set(scored_ids) & set(clip_ids)
