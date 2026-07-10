"""POST /api/videos/{id}/scan-duplicates - tags overlapping clip candidates
and clears stale tags on re-scan (clip-deduplication Stage 2)."""
from __future__ import annotations

from yuu_clip.db.models import ClipCandidate, make_session
from yuu_clip.scoring.dedup import DUPLICATE_TAG


def _video_id(client) -> int:
    return client.get("/api/videos").json()[0]["id"]


def _add_overlapping_pair(client, video_id: int) -> tuple[int, int]:
    """Two clips overlapping ~83% of the shorter, well clear of the seeded ones."""
    db = make_session(client.app.state.ctx.db_path)
    first = ClipCandidate(video_id=video_id, start_ms=200_000, end_ms=260_000, status="pending")
    second = ClipCandidate(video_id=video_id, start_ms=210_000, end_ms=270_000, status="pending")
    db.add_all([first, second])
    db.commit()
    ids = (first.id, second.id)
    db.close()
    return ids


def _tags(client, clip_id: int) -> list[str]:
    db = make_session(client.app.state.ctx.db_path)
    tags = db.get(ClipCandidate, clip_id).tags
    db.close()
    return tags


def test_scan_flags_and_tags_overlapping_pair(client):
    video_id = _video_id(client)
    first_id, second_id = _add_overlapping_pair(client, video_id)

    body = client.post(f"/api/videos/{video_id}/scan-duplicates").json()

    assert body["clips_flagged"] == 2
    assert body["pairs"] == [{"clip_a_id": first_id, "clip_b_id": second_id, "overlap_ratio": 0.833}]
    assert DUPLICATE_TAG in _tags(client, first_id)
    assert DUPLICATE_TAG in _tags(client, second_id)


def test_seeded_non_overlapping_clips_flag_nothing(client):
    video_id = _video_id(client)
    body = client.post(f"/api/videos/{video_id}/scan-duplicates").json()
    assert body["clips_flagged"] == 0
    assert body["pairs"] == []


def test_rescan_clears_stale_tag_after_one_side_rejected(client):
    video_id = _video_id(client)
    first_id, second_id = _add_overlapping_pair(client, video_id)
    client.post(f"/api/videos/{video_id}/scan-duplicates")

    db = make_session(client.app.state.ctx.db_path)
    db.get(ClipCandidate, first_id).status = "rejected"
    db.commit()
    db.close()

    body = client.post(f"/api/videos/{video_id}/scan-duplicates").json()

    assert body["clips_flagged"] == 0
    assert DUPLICATE_TAG not in _tags(client, first_id)
    assert DUPLICATE_TAG not in _tags(client, second_id)


def test_scan_unknown_video_returns_404(client):
    assert client.post("/api/videos/999999/scan-duplicates").status_code == 404


def test_merging_clears_the_duplicate_tag_from_survivor(client):
    video_id = _video_id(client)
    survivor_id, partner_id = _add_overlapping_pair(client, video_id)
    client.post(f"/api/videos/{video_id}/scan-duplicates")
    assert DUPLICATE_TAG in _tags(client, survivor_id)

    res = client.post(f"/api/clips/{survivor_id}/merge", json={"clip_b_id": partner_id})

    assert res.status_code == 200
    assert DUPLICATE_TAG not in _tags(client, survivor_id)
