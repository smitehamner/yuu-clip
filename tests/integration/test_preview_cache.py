"""Preview-cache invalidation regression test.

Split out from the pure ``test_utils`` unit tests: this one drives clip-timing
updates through a ``TestClient`` and needs the seeded project DB.
"""
from __future__ import annotations


class TestPreviewCacheInvalidation:
    """Updating clip timing must evict the cached preview file so the next
    request regenerates it from the new offsets."""

    def _first_clip_id(self, client) -> int:
        vid_id = client.get("/api/videos").json()[0]["id"]
        return client.get(f"/api/videos/{vid_id}/clips").json()[0]["id"]

    def test_timing_update_evicts_preview_cache(self, client, project_dir):
        """After PATCH /timing, the in-memory cache entry for that clip must be
        removed so a stale preview is never served."""
        preview_cache = client.app.state.ctx.preview_cache

        clip_id = self._first_clip_id(client)

        # Manually plant a fake preview file in the per-context cache to simulate
        # a previously generated preview.
        preview_dir = project_dir / ".yuu-clip" / "preview_cache"
        preview_dir.mkdir(parents=True, exist_ok=True)
        fake_preview = preview_dir / f"clip_{clip_id}_preview.mp4"
        fake_preview.write_bytes(b"old preview content")
        preview_cache[clip_id] = fake_preview

        # Update clip timing - this must evict the cache entry and delete the file.
        r = client.patch(f"/api/clips/{clip_id}/timing",
                         json={"start_offset": 2.0, "end_offset": -1.0})
        assert r.status_code == 200

        assert clip_id not in preview_cache, (
            "Cache entry was not evicted after timing update"
        )
        assert not fake_preview.exists(), (
            "Stale preview file was not deleted after timing update"
        )
