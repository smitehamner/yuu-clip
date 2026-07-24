"""yuu_clip/segments/windower.py clip-timing route: client-bound tests.

Pure windower/overlap logic moved to tests/unit/test_segments.py."""

from __future__ import annotations

# ---------------------------------------------------------------------------
# Clip timing
# ---------------------------------------------------------------------------

class TestClipTiming:
    """PATCH /api/clips/{id}/timing - stores start_offset and end_offset."""

    def _first_clip_id(self, client) -> int:
        vid_id = client.get("/api/videos").json()[0]["id"]
        return client.get(f"/api/videos/{vid_id}/clips").json()[0]["id"]

    def test_set_timing_offsets_returned_in_response(self, client):
        clip_id = self._first_clip_id(client)
        r = client.patch(f"/api/clips/{clip_id}/timing", json={
            "start_offset": 2.5, "end_offset": -1.0,
        })
        assert r.status_code == 200
        d = r.json()
        assert abs(d["start_offset"] - 2.5) < 1e-6
        assert abs(d["end_offset"] - (-1.0)) < 1e-6

    def test_timing_offsets_persisted(self, client):
        clip_id = self._first_clip_id(client)
        client.patch(f"/api/clips/{clip_id}/timing", json={"start_offset": 3.0, "end_offset": 0.0})
        d = client.get(f"/api/clips/{clip_id}").json()
        assert abs(d["start_offset"] - 3.0) < 1e-6
        assert d["end_offset"] == 0.0

    def test_clip_detail_includes_offset_fields(self, client):
        clip_id = self._first_clip_id(client)
        d = client.get(f"/api/clips/{clip_id}").json()
        assert "start_offset" in d
        assert "end_offset" in d

    def test_timing_patch_404(self, client):
        r = client.patch("/api/clips/99999/timing", json={"start_offset": 0.0, "end_offset": 0.0})
        assert r.status_code == 404

    def _clip_length_s(self, client, clip_id) -> float:
        d = client.get(f"/api/clips/{clip_id}").json()
        return (d["end_ms"] - d["start_ms"]) / 1000.0

    def test_trim_that_empties_the_window_is_rejected(self, client):
        """The export dialog's trim fields are free text, so a trim that crosses over
        itself is typeable. Unchecked it reaches ffmpeg as a zero-length cut, which
        exits 0 with a fraction-of-a-second file and is recorded as a success."""
        clip_id = self._first_clip_id(client)
        half = self._clip_length_s(client, clip_id) / 2.0
        r = client.patch(f"/api/clips/{clip_id}/timing", json={
            "start_offset": half, "end_offset": -half,
        })
        assert r.status_code == 400
        assert "leave no clip" in r.json()["detail"]

    def test_trim_that_crosses_over_is_rejected(self, client):
        clip_id = self._first_clip_id(client)
        length = self._clip_length_s(client, clip_id)
        r = client.patch(f"/api/clips/{clip_id}/timing", json={
            "start_offset": 0.0, "end_offset": -(length + 5.0),
        })
        assert r.status_code == 400

    def test_rejected_trim_leaves_the_previous_offsets_intact(self, client):
        clip_id = self._first_clip_id(client)
        client.patch(f"/api/clips/{clip_id}/timing", json={"start_offset": 1.0, "end_offset": -1.0})
        length = self._clip_length_s(client, clip_id)
        client.patch(f"/api/clips/{clip_id}/timing", json={
            "start_offset": 0.0, "end_offset": -(length + 5.0),
        })
        d = client.get(f"/api/clips/{clip_id}").json()
        assert abs(d["start_offset"] - 1.0) < 1e-6
        assert abs(d["end_offset"] - (-1.0)) < 1e-6
