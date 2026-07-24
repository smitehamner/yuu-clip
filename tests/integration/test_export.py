"""Export: client-bound route tests.

Pure command/filter-construction, window math, and file-deletion logic moved
to tests/unit/test_export.py."""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

from yuu_clip.db.models import ClipCandidate, make_session

# ---------------------------------------------------------------------------
# Media serving - full/range requests
# ---------------------------------------------------------------------------

class TestShareDeleteMediaServing:
    """Exports must be deletable while still being streamed (the WinError 32 fix)."""

    def test_serves_full_file(self, client, project_dir):
        body = b"abcdefgh" * 100
        (project_dir / ".yuu-clip" / "exports" / "sample.mkv").write_bytes(body)
        r = client.get("/media/exports/sample.mkv")
        assert r.status_code == 200
        assert r.content == body
        assert r.headers["accept-ranges"] == "bytes"

    def test_serves_single_range(self, client, project_dir):
        body = bytes(range(256)) * 10  # 2560 bytes
        (project_dir / ".yuu-clip" / "exports" / "sample.mkv").write_bytes(body)
        r = client.get("/media/exports/sample.mkv", headers={"Range": "bytes=10-19"})
        assert r.status_code == 206
        assert r.headers["content-range"] == "bytes 10-19/2560"
        assert r.content == body[10:20]

    def test_unsatisfiable_range_returns_416(self, client, project_dir):
        (project_dir / ".yuu-clip" / "exports" / "sample.mkv").write_bytes(b"x" * 10)
        r = client.get("/media/exports/sample.mkv", headers={"Range": "bytes=999-1099"})
        assert r.status_code == 416

    def test_suffix_range_serves_file_tail(self, client, project_dir):
        # RFC 7233 "bytes=-N" means the LAST N bytes (Safari probes with bytes=-1).
        body = bytes(range(256)) * 10  # 2560 bytes
        (project_dir / ".yuu-clip" / "exports" / "sample.mkv").write_bytes(body)
        r = client.get("/media/exports/sample.mkv", headers={"Range": "bytes=-20"})
        assert r.status_code == 206
        assert r.headers["content-range"] == "bytes 2540-2559/2560"
        assert r.content == body[-20:]

    def test_suffix_range_larger_than_file_serves_whole_file(self, client, project_dir):
        (project_dir / ".yuu-clip" / "exports" / "sample.mkv").write_bytes(b"x" * 10)
        r = client.get("/media/exports/sample.mkv", headers={"Range": "bytes=-999"})
        assert r.status_code == 206
        assert r.headers["content-range"] == "bytes 0-9/10"
        assert r.content == b"x" * 10

    def test_zero_suffix_range_returns_416(self, client, project_dir):
        (project_dir / ".yuu-clip" / "exports" / "sample.mkv").write_bytes(b"x" * 10)
        r = client.get("/media/exports/sample.mkv", headers={"Range": "bytes=-0"})
        assert r.status_code == 416

    def test_missing_export_returns_404(self, client):
        assert client.get("/media/exports/nope.mkv").status_code == 404


# ---------------------------------------------------------------------------
# Demo reel start + list
# ---------------------------------------------------------------------------

class TestDemoStart:
    def test_start_rejects_invalid_transition(self, client):
        r = client.post("/api/demo/start", json={"transition": "dissolve_to_mars"})
        assert r.status_code == 400

    def test_start_rejects_when_video_has_no_approved_clips(self, client):
        r = client.post("/api/demo/start", json={"video_id": 99999, "transition": "fade"})
        assert r.status_code == 400

    def test_start_queues_command_and_returns_clip_count(self, client):
        r = client.post("/api/demo/start", json={"transition": "fade"})
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "started"
        assert d["clip_count"] >= 1
        assert d["output_name"].endswith(".mkv")


class TestDemoList:
    def test_list_reels_empty(self, client):
        r = client.get("/api/demo/list")
        assert r.status_code == 200
        assert r.json() == []

    def test_list_reels_returns_files(self, client, project_dir):
        reels_dir = project_dir / ".yuu-clip" / "reels"
        reels_dir.mkdir(parents=True, exist_ok=True)
        (reels_dir / "highlights_20260101.mkv").write_bytes(b"fake reel")
        r = client.get("/api/demo/list")
        assert r.status_code == 200
        reels = r.json()
        assert len(reels) == 1
        assert reels[0]["filename"] == "highlights_20260101.mkv"
        assert "url" in reels[0]
        assert "size_mb" in reels[0]
        assert "date" in reels[0]


class TestDemoListFiltering:
    def test_non_mkv_files_not_listed(self, client, project_dir):
        reels_dir = project_dir / ".yuu-clip" / "reels"
        reels_dir.mkdir(parents=True, exist_ok=True)
        (reels_dir / "highlights_20260101.mkv").write_bytes(b"reel")
        (reels_dir / "notes.txt").write_text("ignore me")
        (reels_dir / "thumbnail.png").write_bytes(b"img")
        r = client.get("/api/demo/list")
        assert r.status_code == 200
        reels = r.json()
        names = [x["filename"] for x in reels]
        assert "highlights_20260101.mkv" in names
        assert "notes.txt" not in names
        assert "thumbnail.png" not in names

    def test_reels_sorted_newest_first(self, client, project_dir):
        import os
        reels_dir = project_dir / ".yuu-clip" / "reels"
        reels_dir.mkdir(parents=True, exist_ok=True)
        older = reels_dir / "old_20260101.mkv"
        older.write_bytes(b"old")
        newer = reels_dir / "new_20260102.mkv"
        newer.write_bytes(b"new")
        # Set mtimes explicitly - sleeping between writes made ordering depend
        # on filesystem timestamp resolution.
        now = os.path.getmtime(newer)
        os.utime(older, (now - 60, now - 60))
        r = client.get("/api/demo/list")
        reels = r.json()
        assert len(reels) == 2
        assert reels[0]["filename"] == "new_20260102.mkv"


class TestMultiExtensionExport:
    """Clips exported as non-.mkv containers are found by media_url, has_export, and delete."""

    def _first_clip(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        return client.get(f"/api/videos/{vid_id}/clips").json()[0]

    def test_media_url_finds_mp4_export(self, client, project_dir):
        clip = self._first_clip(client)
        export_dir = project_dir / ".yuu-clip" / "exports"
        start_hms_dashes = clip["start_hms"].replace(":", "-")
        mp4_file = export_dir / f"session_clip{clip['id']}_{start_hms_dashes}.mp4"
        mp4_file.write_bytes(b"fake mp4 video")
        r = client.get(f"/api/clips/{clip['id']}/media_url")
        assert r.status_code == 200
        d = r.json()
        assert d["url"] is not None
        assert d["url"].endswith(".mp4")

    def test_has_export_true_for_mp4(self, client, project_dir):
        vid_id = client.get("/api/videos").json()[0]["id"]
        clips = client.get(f"/api/videos/{vid_id}/clips").json()
        c = clips[0]
        export_dir = project_dir / ".yuu-clip" / "exports"
        start_hms_dashes = c["start_hms"].replace(":", "-")
        mp4_file = export_dir / f"session_clip{c['id']}_{start_hms_dashes}.mp4"
        mp4_file.write_bytes(b"fake mp4 video")
        clips2 = client.get(f"/api/videos/{vid_id}/clips").json()
        match = next(x for x in clips2 if x["id"] == c["id"])
        assert match["has_export"] is True

    def test_delete_clip_removes_mp4_export(self, client, project_dir):
        vid_id = client.get("/api/videos").json()[0]["id"]
        clips = client.get(f"/api/videos/{vid_id}/clips").json()
        c = clips[0]
        export_dir = project_dir / ".yuu-clip" / "exports"
        start_hms_dashes = c["start_hms"].replace(":", "-")
        mp4_file = export_dir / f"session_clip{c['id']}_{start_hms_dashes}.mp4"
        mp4_file.write_bytes(b"fake mp4 video")
        assert mp4_file.exists()
        client.delete(f"/api/clips/{c['id']}")
        assert not mp4_file.exists()

    def test_delete_video_removes_mp4_exports(self, client, project_dir):
        vid_id = client.get("/api/videos").json()[0]["id"]
        clips = client.get(f"/api/videos/{vid_id}/clips").json()
        export_dir = project_dir / ".yuu-clip" / "exports"
        mp4_files = []
        for c in clips:
            start_hms_dashes = c["start_hms"].replace(":", "-")
            f = export_dir / f"session_clip{c['id']}_{start_hms_dashes}.mp4"
            f.write_bytes(b"fake mp4 video")
            mp4_files.append(f)
        client.delete(f"/api/videos/{vid_id}")
        for f in mp4_files:
            assert not f.exists(), f"{f.name} should have been deleted"


class TestExportNameTemplateAffectsWebLookup:
    """A custom export_name_template must be honored by the web routes that
    locate already-exported files on disk (has_export, media_url, delete) -
    not just by the CLI export command that creates them."""

    def test_has_export_true_only_for_current_template_pattern(self, client, project_dir):
        r = client.patch("/api/config", json={"export_name_template": "{date}_{video}_{clip_id}"})
        assert r.status_code == 200

        vid_id = client.get("/api/videos").json()[0]["id"]
        clips = client.get(f"/api/videos/{vid_id}/clips").json()
        c = clips[0]

        from datetime import date
        export_dir = project_dir / ".yuu-clip" / "exports"
        old_pattern_file = export_dir / f"session_clip{c['id']}_{c['start_hms'].replace(':', '-')}.mkv"
        new_pattern_file = export_dir / f"{date.today().isoformat()}_session_{c['id']}.mkv"
        old_pattern_file.write_bytes(b"fake video")

        clips_before = client.get(f"/api/videos/{vid_id}/clips").json()
        assert next(x for x in clips_before if x["id"] == c["id"])["has_export"] is False

        old_pattern_file.unlink()
        new_pattern_file.write_bytes(b"fake video")
        clips_after = client.get(f"/api/videos/{vid_id}/clips").json()
        assert next(x for x in clips_after if x["id"] == c["id"])["has_export"] is True


class TestDemoOutputMkv:
    """Demo output_name always gets .mkv extension."""

    def test_start_demo_adds_mkv_to_bare_name(self, client):
        """If output_name has no extension, the route must append .mkv."""
        r = client.post("/api/demo/start", json={
            "transition": "fade",
            "output_name": "myreel",
        })
        assert r.status_code == 200
        assert r.json()["output_name"].endswith(".mkv")

    def test_start_demo_does_not_double_add_mkv(self, client):
        """If output_name already ends in .mkv, do not append again."""
        r = client.post("/api/demo/start", json={
            "transition": "fade",
            "output_name": "myreel.mkv",
        })
        assert r.status_code == 200
        assert r.json()["output_name"] == "myreel.mkv"


class TestBatchExportValidation:
    def _vid_id(self, client):
        return client.get("/api/videos").json()[0]["id"]

    def test_invalid_container_rejected(self, client):
        vid_id = self._vid_id(client)
        r = client.get(f"/api/videos/{vid_id}/batch-export?container=avi")
        assert r.status_code == 400

    def test_valid_containers_accepted(self, client):
        vid_id = self._vid_id(client)
        # Both mkv and mp4 should pass validation; no approved clips exist at score>1.0
        for fmt in ("mkv", "mp4"):
            r = client.get(f"/api/videos/{vid_id}/batch-export?container={fmt}&min_score=1.1")
            # 400 because no clips pass the filter, not because container is wrong
            assert r.status_code == 400
            assert "container" not in r.text.lower()

    def test_video_not_found(self, client):
        r = client.get("/api/videos/99999/batch-export")
        assert r.status_code == 404

    def test_no_approved_clips_returns_400(self, client):
        vid_id = self._vid_id(client)
        # Use min_score > 1.0 so no clips can pass
        r = client.get(f"/api/videos/{vid_id}/batch-export?min_score=1.1")
        assert r.status_code == 400

    def test_invalid_retranscribe_model_returns_400(self, client):
        vid_id = self._vid_id(client)
        r = client.get(f"/api/videos/{vid_id}/batch-export?retranscribe=true&retranscribe_model=gpt-4o&min_score=1.1")
        assert r.status_code == 400

    def test_valid_retranscribe_model_passes_validation(self, client):
        vid_id = self._vid_id(client)
        # min_score=1.1 means no clips pass filter → 400 from clip check, not model validation
        for mdl in ("tiny", "base", "small", "medium", "large-v3"):
            r = client.get(f"/api/videos/{vid_id}/batch-export?retranscribe=true&retranscribe_model={mdl}&min_score=1.1")
            assert r.status_code == 400
            assert "model" not in r.text.lower()

    def test_retranscribe_false_skips_model_validation(self, client):
        vid_id = self._vid_id(client)
        # retranscribe=false with a bad model name should be fine (validation skipped)
        r = client.get(f"/api/videos/{vid_id}/batch-export?retranscribe=false&retranscribe_model=gpt-4o&min_score=1.1")
        assert r.status_code == 400
        assert "model" not in r.text.lower()


class TestApprovedClipsForReel:
    def _vid_id(self, client):
        return client.get("/api/videos").json()[0]["id"]

    def test_returns_approved_clips_only(self, client):
        r = client.get("/api/demo/approved-clips")
        assert r.status_code == 200
        clips = r.json()
        # conftest seeds one approved clip
        assert len(clips) == 1
        assert all(c["id"] for c in clips)

    def test_response_shape(self, client):
        clips = client.get("/api/demo/approved-clips").json()
        assert len(clips) >= 1
        c = clips[0]
        for key in ("id", "video_id", "video_name", "start_hms", "duration_hms",
                    "duration_ms", "score_overall", "description", "has_export"):
            assert key in c, f"missing key: {key}"

    def test_filter_by_video_id(self, client):
        vid_id = self._vid_id(client)
        r = client.get(f"/api/demo/approved-clips?video_id={vid_id}")
        assert r.status_code == 200
        clips = r.json()
        assert all(c["video_id"] == vid_id for c in clips)

    def test_filter_by_nonexistent_video_returns_empty(self, client):
        r = client.get("/api/demo/approved-clips?video_id=99999")
        assert r.status_code == 200
        assert r.json() == []


class TestPerLabelSrtSidecarDeletion:
    """Per-label SRT sidecars (e.g. .player_voice.srt) are removed on clip/video delete."""

    def _first_clip(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        return client.get(f"/api/videos/{vid_id}/clips").json()[0]

    def test_delete_clip_removes_per_label_srt(self, client, project_dir):
        clip = self._first_clip(client)
        export_dir = project_dir / ".yuu-clip" / "exports"
        start_hms_dashes = clip["start_hms"].replace(":", "-")
        stem = f"session_clip{clip['id']}_{start_hms_dashes}"
        pv_srt = export_dir / f"{stem}.player_voice.srt"
        vc_srt = export_dir / f"{stem}.ingame_voicechat.srt"
        merged_srt = export_dir / f"{stem}.srt"
        pv_srt.write_text("1\n00:00:00,000 --> 00:00:01,000\nHi\n\n", encoding="utf-8")
        vc_srt.write_text("1\n00:00:00,000 --> 00:00:01,000\nHey\n\n", encoding="utf-8")
        merged_srt.write_text("1\n00:00:00,000 --> 00:00:01,000\n[Player] Hi\n\n", encoding="utf-8")

        client.delete(f"/api/clips/{clip['id']}")

        assert not pv_srt.exists(), "player_voice sidecar should have been deleted"
        assert not vc_srt.exists(), "ingame_voicechat sidecar should have been deleted"
        assert not merged_srt.exists(), "merged sidecar should have been deleted"

    def test_delete_video_removes_per_label_srts(self, client, project_dir):
        vid_id = client.get("/api/videos").json()[0]["id"]
        clips = client.get(f"/api/videos/{vid_id}/clips").json()
        export_dir = project_dir / ".yuu-clip" / "exports"
        srt_files = []
        for c in clips:
            start_hms_dashes = c["start_hms"].replace(":", "-")
            stem = f"session_clip{c['id']}_{start_hms_dashes}"
            f = export_dir / f"{stem}.player_voice.srt"
            f.write_text("1\n00:00:00,000 --> 00:00:01,000\nSpeech\n\n", encoding="utf-8")
            srt_files.append(f)

        client.delete(f"/api/videos/{vid_id}")

        for f in srt_files:
            assert not f.exists(), f"{f.name} should have been deleted with the video"


class TestExportVideoTranscript:
    """POST /api/videos/{id}/export-transcript writes SRT next to the source file."""

    def _seed_transcript(self, project_dir):
        from yuu_clip.db.models import AudioTrack, Transcript, TranscriptSegment, Video, make_session
        db_path = project_dir / ".yuu-clip" / "project.db"
        session = make_session(db_path)
        try:
            vid = session.query(Video).first()
            track = session.query(AudioTrack).filter_by(video_id=vid.id).first()
            tx = Transcript(audio_track_id=track.id, model_name="large-v3")
            session.add(tx)
            session.flush()
            session.add(TranscriptSegment(transcript_id=tx.id, start_ms=0, end_ms=2000, text="Hello world"))
            session.add(TranscriptSegment(transcript_id=tx.id, start_ms=3000, end_ms=5000, text="Second line"))
            session.commit()
            return vid.id, vid.path
        finally:
            session.close()

    def test_exports_srt_next_to_source(self, client, project_dir, tmp_path):
        vid_id, source_path = self._seed_transcript(project_dir)
        r = client.post(f"/api/videos/{vid_id}/export-transcript")
        assert r.status_code == 200, r.text
        data = r.json()
        from pathlib import Path
        srt_path = Path(data["path"])
        assert srt_path.suffix == ".srt"
        assert srt_path.stem == Path(source_path).stem
        assert srt_path.exists()
        content = srt_path.read_text(encoding="utf-8")
        assert "Hello world" in content
        assert "Second line" in content

    def test_returns_409_when_srt_exists(self, client, project_dir):
        vid_id, source_path = self._seed_transcript(project_dir)
        from pathlib import Path
        existing = Path(source_path).with_suffix(".srt")
        existing.write_text("old content", encoding="utf-8")
        r = client.post(f"/api/videos/{vid_id}/export-transcript")
        assert r.status_code == 409
        data = r.json()
        assert data["exists"] is True
        assert data["path"] == str(existing)
        assert existing.read_text(encoding="utf-8") == "old content"

    def test_overwrite_param_replaces_existing(self, client, project_dir):
        vid_id, source_path = self._seed_transcript(project_dir)
        from pathlib import Path
        existing = Path(source_path).with_suffix(".srt")
        existing.write_text("old content", encoding="utf-8")
        r = client.post(f"/api/videos/{vid_id}/export-transcript?overwrite=true")
        assert r.status_code == 200
        assert "Hello world" in existing.read_text(encoding="utf-8")

    def test_returns_400_when_no_transcript(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        r = client.post(f"/api/videos/{vid_id}/export-transcript")
        assert r.status_code == 400

    def test_returns_404_for_missing_video(self, client):
        r = client.post("/api/videos/99999/export-transcript")
        assert r.status_code == 404


class TestVideoTranscriptSrtStale:
    """video.transcript_srt_stale (B16) - compares transcript_edited_at against the
    on-disk SRT sidecar's own mtime, so a caption edit after the SRT was written
    (or a pre-existing SRT older than the transcript) surfaces the stale badge."""

    def _set_edited_at(self, project_dir, video_id: int, when: datetime) -> None:
        from yuu_clip.db.models import Video
        session = make_session(project_dir / ".yuu-clip" / "project.db")
        video = session.get(Video, video_id)
        video.transcript_edited_at = when
        session.commit()
        session.close()

    def test_false_when_transcript_never_edited(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        assert client.get(f"/api/videos/{vid_id}").json()["transcript_srt_stale"] is False

    def test_false_when_no_sidecar_exists_yet(self, client, project_dir):
        vid_id = client.get("/api/videos").json()[0]["id"]
        self._set_edited_at(project_dir, vid_id, datetime.now(timezone.utc))
        assert client.get(f"/api/videos/{vid_id}").json()["transcript_srt_stale"] is False

    def test_true_when_edited_after_sidecar_was_written(self, client, project_dir):
        vid_id, source_path = self._id_and_path(client)
        srt = Path(source_path).with_suffix(".srt")
        srt.write_text("1\n00:00:00,000 --> 00:00:01,000\nold\n\n", encoding="utf-8")
        old_mtime = datetime.now(timezone.utc) - timedelta(hours=1)
        os.utime(srt, (old_mtime.timestamp(), old_mtime.timestamp()))

        self._set_edited_at(project_dir, vid_id, datetime.now(timezone.utc))

        assert client.get(f"/api/videos/{vid_id}").json()["transcript_srt_stale"] is True

    def test_false_when_sidecar_written_after_the_edit(self, client, project_dir):
        vid_id, source_path = self._id_and_path(client)
        self._set_edited_at(project_dir, vid_id, datetime.now(timezone.utc) - timedelta(hours=1))

        srt = Path(source_path).with_suffix(".srt")
        srt.write_text("1\n00:00:00,000 --> 00:00:01,000\nfresh\n\n", encoding="utf-8")

        assert client.get(f"/api/videos/{vid_id}").json()["transcript_srt_stale"] is False

    def _id_and_path(self, client) -> tuple[int, str]:
        video = client.get("/api/videos").json()[0]
        return video["id"], video["path"]


# ---------------------------------------------------------------------------
# export_stale staleness matrix - GET /api/clips/{id}.
#
# Uses explicit before/after timestamps rather than wall-clock call ordering, so the
# matrix isn't sensitive to how fast the test process happens to run.
# ---------------------------------------------------------------------------

class TestExportStaleness:
    def _first_clip(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        return client.get(f"/api/videos/{vid_id}/clips").json()[0]

    def _seed(self, project_dir: Path, clip_id: int, start_hms: str, exported_at, **fields):
        """Write a fake export file on disk and set exported_at plus any exported_*/
        *_edited_at fields directly on the clip row."""
        export_dir = project_dir / ".yuu-clip" / "exports"
        stem = f"session_clip{clip_id}_{start_hms.replace(':', '-')}"
        (export_dir / f"{stem}.mkv").write_bytes(b"fake video")

        db = make_session(project_dir / ".yuu-clip" / "project.db")
        clip = db.get(ClipCandidate, clip_id)
        clip.exported_at = exported_at
        for key, value in fields.items():
            setattr(clip, key, value)
        db.commit()
        db.close()

    def test_plain_cut_not_stale_after_caption_edit(self, client, project_dir):
        now = datetime.now(timezone.utc)
        clip = self._first_clip(client)
        self._seed(project_dir, clip["id"], clip["start_hms"],
                    exported_at=now, transcript_edited_at=now + timedelta(minutes=1))

        detail = client.get(f"/api/clips/{clip['id']}").json()
        assert detail["export_stale"] is False
        assert detail["export_stale_reasons"] == []

    def test_burned_captions_stale_after_caption_edit(self, client, project_dir):
        now = datetime.now(timezone.utc)
        clip = self._first_clip(client)
        self._seed(project_dir, clip["id"], clip["start_hms"],
                    exported_at=now, exported_burn_subs=True,
                    transcript_edited_at=now + timedelta(minutes=1))

        detail = client.get(f"/api/clips/{clip['id']}").json()
        assert detail["export_stale"] is True
        assert detail["export_stale_reasons"] == ["captions changed"]

    def test_embedded_captions_stale_after_caption_edit(self, client, project_dir):
        now = datetime.now(timezone.utc)
        clip = self._first_clip(client)
        self._seed(project_dir, clip["id"], clip["start_hms"],
                    exported_at=now, exported_embed_subs=True,
                    transcript_edited_at=now + timedelta(minutes=1))

        detail = client.get(f"/api/clips/{clip['id']}").json()
        assert detail["export_stale"] is True
        assert detail["export_stale_reasons"] == ["captions changed"]

    def test_any_export_stale_after_trim_change(self, client, project_dir):
        now = datetime.now(timezone.utc)
        clip = self._first_clip(client)
        self._seed(project_dir, clip["id"], clip["start_hms"],
                    exported_at=now, trim_edited_at=now + timedelta(minutes=1))

        detail = client.get(f"/api/clips/{clip['id']}").json()
        assert detail["export_stale"] is True
        assert detail["export_stale_reasons"] == ["clip window changed"]

    def test_title_card_export_stale_after_description_edit(self, client, project_dir):
        now = datetime.now(timezone.utc)
        clip = self._first_clip(client)
        self._seed(project_dir, clip["id"], clip["start_hms"],
                    exported_at=now, exported_title_card=True,
                    description_edited_at=now + timedelta(minutes=1))

        detail = client.get(f"/api/clips/{clip['id']}").json()
        assert detail["export_stale"] is True
        assert detail["export_stale_reasons"] == ["description changed"]

    def test_plain_export_not_stale_after_description_edit_without_title_card(self, client, project_dir):
        now = datetime.now(timezone.utc)
        clip = self._first_clip(client)
        self._seed(project_dir, clip["id"], clip["start_hms"],
                    exported_at=now, description_edited_at=now + timedelta(minutes=1))

        detail = client.get(f"/api/clips/{clip['id']}").json()
        assert detail["export_stale"] is False

    def test_edit_before_export_is_not_stale(self, client, project_dir):
        """An export made after the transcript edit already reflects it."""
        now = datetime.now(timezone.utc)
        clip = self._first_clip(client)
        self._seed(project_dir, clip["id"], clip["start_hms"],
                    exported_at=now, exported_burn_subs=True,
                    transcript_edited_at=now - timedelta(minutes=1))

        detail = client.get(f"/api/clips/{clip['id']}").json()
        assert detail["export_stale"] is False

    def test_no_badge_when_never_exported(self, client, project_dir):
        clip = self._first_clip(client)
        db = make_session(project_dir / ".yuu-clip" / "project.db")
        db.get(ClipCandidate, clip["id"]).trim_edited_at = datetime.now(timezone.utc)
        db.commit()
        db.close()

        detail = client.get(f"/api/clips/{clip['id']}").json()
        assert detail["has_export"] is False
        assert detail["export_stale"] is False

    def test_no_badge_when_export_file_deleted(self, client, project_dir):
        now = datetime.now(timezone.utc)
        clip = self._first_clip(client)
        self._seed(project_dir, clip["id"], clip["start_hms"],
                    exported_at=now, trim_edited_at=now + timedelta(minutes=1))
        stem = f"session_clip{clip['id']}_{clip['start_hms'].replace(':', '-')}"
        (project_dir / ".yuu-clip" / "exports" / f"{stem}.mkv").unlink()

        detail = client.get(f"/api/clips/{clip['id']}").json()
        assert detail["has_export"] is False
        assert detail["export_stale"] is False


# ---------------------------------------------------------------------------
# clip_exports rows - Plan 07 Stage 1 (one-row-per-format export tracking).
# ---------------------------------------------------------------------------

class TestClipExportRows:
    def _first_clip(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        return client.get(f"/api/videos/{vid_id}/clips").json()[0]

    def _write_export_file(self, project_dir: Path, name: str) -> Path:
        p = project_dir / ".yuu-clip" / "exports" / name
        p.write_bytes(b"fake video payload")
        return p

    def _record(self, project_dir: Path, clip_id: int, preset_name: str, filename: str):
        from yuu_clip.export.render import _record_clip_export

        path = self._write_export_file(project_dir, filename)
        db = make_session(project_dir / ".yuu-clip" / "project.db")
        clip = db.get(ClipCandidate, clip_id)
        _record_clip_export(clip, db, preset_name, path, {"burn_subs": False, "embed_subs": False, "title_card": False})
        db.commit()
        db.close()
        return path

    def test_export_creates_a_row(self, client, project_dir):
        clip = self._first_clip(client)
        self._record(project_dir, clip["id"], "default", "session_clip1_0-00.mkv")

        detail = client.get(f"/api/clips/{clip['id']}").json()
        assert len(detail["exports"]) == 1
        assert detail["exports"][0]["preset_name"] == "default"
        assert detail["has_export"] is True

    def test_same_preset_reexport_replaces_the_row(self, client, project_dir):
        clip = self._first_clip(client)
        self._record(project_dir, clip["id"], "youtube-1080p", "session_clip1_0-00_youtube-1080p.mp4")
        first = client.get(f"/api/clips/{clip['id']}").json()["exports"][0]

        self._record(project_dir, clip["id"], "youtube-1080p", "session_clip1_0-00_youtube-1080p.mp4")
        detail = client.get(f"/api/clips/{clip['id']}").json()

        assert len(detail["exports"]) == 1
        assert detail["exports"][0]["id"] == first["id"]  # same row, updated in place

    def test_different_preset_adds_a_row(self, client, project_dir):
        clip = self._first_clip(client)
        self._record(project_dir, clip["id"], "default", "session_clip1_0-00.mkv")
        self._record(project_dir, clip["id"], "youtube-1080p", "session_clip1_0-00_youtube-1080p.mp4")

        detail = client.get(f"/api/clips/{clip['id']}").json()
        assert len(detail["exports"]) == 2
        assert {e["preset_name"] for e in detail["exports"]} == {"default", "youtube-1080p"}

    def test_per_row_delete_removes_only_its_file(self, client, project_dir):
        clip = self._first_clip(client)
        default_path = self._record(project_dir, clip["id"], "default", "session_clip1_0-00.mkv")
        self._record(project_dir, clip["id"], "youtube-1080p", "session_clip1_0-00_youtube-1080p.mp4")
        detail = client.get(f"/api/clips/{clip['id']}").json()
        default_export_id = next(e["id"] for e in detail["exports"] if e["preset_name"] == "default")

        res = client.delete(f"/api/clip-exports/{default_export_id}")
        assert res.status_code == 200
        assert not default_path.exists()

        detail = client.get(f"/api/clips/{clip['id']}").json()
        assert len(detail["exports"]) == 1
        assert detail["exports"][0]["preset_name"] == "youtube-1080p"

    def test_per_row_delete_unknown_id_404s(self, client):
        assert client.delete("/api/clip-exports/999999").status_code == 404

    def test_clip_delete_cascades_rows_and_files(self, client, project_dir):
        clip = self._first_clip(client)
        default_path = self._record(project_dir, clip["id"], "default", "session_clip1_0-00.mkv")
        preset_path = self._record(project_dir, clip["id"], "youtube-1080p", "session_clip1_0-00_youtube-1080p.mp4")

        res = client.delete(f"/api/clips/{clip['id']}")
        assert res.status_code == 200
        assert not default_path.exists()
        assert not preset_path.exists()

        db = make_session(project_dir / ".yuu-clip" / "project.db")
        from yuu_clip.db.models import ClipExport
        assert db.query(ClipExport).filter_by(clip_id=clip["id"]).count() == 0
        db.close()

    def test_export_files_route_lists_every_format(self, client, project_dir):
        clip = self._first_clip(client)
        self._record(project_dir, clip["id"], "default", "session_clip1_0-00.mkv")
        self._record(project_dir, clip["id"], "youtube-1080p", "session_clip1_0-00_youtube-1080p.mp4")

        files = client.get(f"/api/clips/{clip['id']}/export-files").json()["files"]
        assert "session_clip1_0-00.mkv" in files
        assert "session_clip1_0-00_youtube-1080p.mp4" in files

    def test_delete_all_exports_clears_every_row(self, client, project_dir):
        clip = self._first_clip(client)
        default_path = self._record(project_dir, clip["id"], "default", "session_clip1_0-00.mkv")
        preset_path = self._record(project_dir, clip["id"], "youtube-1080p", "session_clip1_0-00_youtube-1080p.mp4")

        res = client.delete(f"/api/clips/{clip['id']}/export")
        assert res.status_code == 200
        assert not default_path.exists()
        assert not preset_path.exists()
        assert client.get(f"/api/clips/{clip['id']}").json()["exports"] == []
