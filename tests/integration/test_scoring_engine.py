"""yuu_clip/scoring/engine.py - client-bound auto-approve route.

Pure ScoringEngine orchestration/weight logic moved to
tests/unit/test_scoring_engine.py."""

from __future__ import annotations

# ---------------------------------------------------------------------------
# Auto-approve endpoint
# ---------------------------------------------------------------------------

class TestAutoApprove:
    def _vid_id(self, client):
        return client.get("/api/videos").json()[0]["id"]

    def test_approves_pending_clips_above_threshold(self, client):
        vid_id = self._vid_id(client)
        # conftest seeds one pending clip with score 0.85
        r = client.post(f"/api/videos/{vid_id}/auto-approve", json={"threshold": 0.8})
        assert r.status_code == 200
        assert r.json()["approved"] == 1

    def test_does_not_approve_below_threshold(self, client):
        vid_id = self._vid_id(client)
        r = client.post(f"/api/videos/{vid_id}/auto-approve", json={"threshold": 0.99})
        assert r.status_code == 200
        assert r.json()["approved"] == 0

    def test_does_not_re_approve_already_approved(self, client):
        vid_id = self._vid_id(client)
        # conftest seeds one approved clip (score 0.60) - threshold 0.5 would match it
        # but it's already approved, not pending, so it should be ignored
        r = client.post(f"/api/videos/{vid_id}/auto-approve", json={"threshold": 0.5})
        assert r.status_code == 200
        # only the pending clip with score 0.85 qualifies; rejected/approved are skipped
        assert r.json()["approved"] == 1

    def test_invalid_threshold_above_one(self, client):
        vid_id = self._vid_id(client)
        r = client.post(f"/api/videos/{vid_id}/auto-approve", json={"threshold": 1.5})
        assert r.status_code == 400

    def test_invalid_threshold_below_zero(self, client):
        vid_id = self._vid_id(client)
        r = client.post(f"/api/videos/{vid_id}/auto-approve", json={"threshold": -0.1})
        assert r.status_code == 400

    def test_invalid_score_field(self, client):
        vid_id = self._vid_id(client)
        r = client.post(f"/api/videos/{vid_id}/auto-approve", json={"threshold": 0.5, "score_field": "nonexistent"})
        assert r.status_code == 400

    def test_valid_sub_score_fields(self, client):
        vid_id = self._vid_id(client)
        for field in ("funny", "dramatic", "action"):
            r = client.post(f"/api/videos/{vid_id}/auto-approve", json={"threshold": 0.99, "score_field": field})
            assert r.status_code == 200

    def test_video_not_found(self, client):
        r = client.post("/api/videos/99999/auto-approve", json={"threshold": 0.5})
        assert r.status_code == 404
