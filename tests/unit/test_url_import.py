"""Import from URL (roadmap plan 08) - validation, metadata inspection, filename
sanitization, progress-line parsing, sidecar handoff, and the API routes.

No real network calls: yt-dlp is always mocked.
"""
from __future__ import annotations

import asyncio
import sys
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

import pytest

# ---------------------------------------------------------------------------
# URL validation
# ---------------------------------------------------------------------------

class TestValidateImportUrl:
    @pytest.mark.parametrize("url", [
        "https://www.youtube.com/watch?v=abc123",
        "https://youtube.com/watch?v=abc123",
        "https://youtu.be/abc123",
        "https://www.twitch.tv/videos/123456789",
        "https://twitch.tv/videos/123456789",
    ])
    def test_accepts_supported_hosts(self, url):
        from yuu_clip.url_import import validate_import_url
        validate_import_url(url)  # must not raise

    @pytest.mark.parametrize("url", [
        "http://www.youtube.com/watch?v=abc123",   # not https
        "https://vimeo.com/12345",                  # unsupported host
        "https://evil.com/youtube.com",             # host spoofing attempt
        "not a url at all",
        "javascript:alert(1)",
        "https://www.youtube.com.evil.com/watch",   # subdomain trick
    ])
    def test_rejects_unsupported_urls(self, url):
        from yuu_clip.url_import import ImportUrlError, validate_import_url
        with pytest.raises(ImportUrlError):
            validate_import_url(url)


# ---------------------------------------------------------------------------
# normalize_import_url
# ---------------------------------------------------------------------------

class TestNormalizeImportUrl:
    def test_no_scheme_gets_https_prepended(self):
        from yuu_clip.url_import import normalize_import_url
        assert normalize_import_url("www.youtube.com/watch?v=abc123") == (
            "https://www.youtube.com/watch?v=abc123"
        )

    def test_http_scheme_upgraded_to_https(self):
        from yuu_clip.url_import import normalize_import_url
        assert normalize_import_url("http://www.youtube.com/watch?v=abc123") == (
            "https://www.youtube.com/watch?v=abc123"
        )

    def test_youtube_playlist_context_params_are_stripped(self):
        from yuu_clip.url_import import normalize_import_url
        url = (
            "https://www.youtube.com/watch?v=_43Ei9eQVww"
            "&list=PL2aBZuCeDwlSoxUrYsYWZr6NBTTKGir8U&index=3&pp=iAQB"
        )
        assert normalize_import_url(url) == "https://www.youtube.com/watch?v=_43Ei9eQVww"

    def test_youtube_timestamp_is_kept(self):
        from yuu_clip.url_import import normalize_import_url
        url = "https://www.youtube.com/watch?v=abc123&list=PL1&t=90"
        assert normalize_import_url(url) == "https://www.youtube.com/watch?v=abc123&t=90"

    def test_youtu_be_short_link_keeps_path_drops_tracking_keeps_timestamp(self):
        from yuu_clip.url_import import normalize_import_url
        assert normalize_import_url("https://youtu.be/abc123?si=xyz&t=42") == (
            "https://youtu.be/abc123?t=42"
        )

    def test_twitch_tracking_params_are_stripped_timestamp_kept(self):
        from yuu_clip.url_import import normalize_import_url
        url = "https://www.twitch.tv/videos/123456789?tt_medium=article&tt_content=clip&t=01h02m03s"
        assert normalize_import_url(url) == (
            "https://www.twitch.tv/videos/123456789?t=01h02m03s"
        )

    def test_already_clean_url_is_unchanged(self):
        from yuu_clip.url_import import normalize_import_url
        url = "https://www.youtube.com/watch?v=abc123"
        assert normalize_import_url(url) == url

    @pytest.mark.parametrize("url", [
        "https://vimeo.com/12345",
        "https://evil.com/youtube.com",
        "not a url at all",
        "javascript:alert(1)",
        "https://www.youtube.com.evil.com/watch",
    ])
    def test_unsupported_host_is_passed_through_for_validation_to_reject(self, url):
        from yuu_clip.url_import import ImportUrlError, normalize_import_url, validate_import_url
        normalized = normalize_import_url(url)
        with pytest.raises(ImportUrlError):
            validate_import_url(normalized)


# ---------------------------------------------------------------------------
# inspect_url
# ---------------------------------------------------------------------------

class TestInspectUrl:
    def _mock_ydl(self, info: dict | None = None, raises: Exception | None = None):
        instance = mock.MagicMock()
        if raises is not None:
            instance.extract_info.side_effect = raises
        else:
            instance.extract_info.return_value = info
        cm = mock.MagicMock()
        cm.__enter__.return_value = instance
        cm.__exit__.return_value = False
        return cm

    def test_maps_metadata_fields(self):
        from yuu_clip.url_import import inspect_url
        info = {
            "title": "Epic Gaming Moment", "uploader": "SomeStreamer",
            "duration": 3600, "upload_date": "20260615",
            "categories": ["Just Chatting"], "filesize_approx": 500_000_000,
            "id": "abc123",
        }
        with mock.patch("yt_dlp.YoutubeDL", return_value=self._mock_ydl(info)):
            result = inspect_url("https://www.youtube.com/watch?v=abc123")
        assert result["title"] == "Epic Gaming Moment"
        assert result["uploader"] == "SomeStreamer"
        assert result["duration_s"] == 3600
        assert result["upload_date"] == "2026-06-15"
        assert result["category"] == "Just Chatting"
        assert result["estimated_size_bytes"] == 500_000_000
        assert result["video_id"] == "abc123"

    def test_missing_optional_fields_default_gracefully(self):
        from yuu_clip.url_import import inspect_url
        info = {"title": "", "id": "xyz"}
        with mock.patch("yt_dlp.YoutubeDL", return_value=self._mock_ydl(info)):
            result = inspect_url("https://youtu.be/xyz")
        assert result["title"] == "(untitled)"
        assert result["uploader"] == ""
        assert result["duration_s"] == 0
        assert result["upload_date"] is None
        assert result["category"] == ""
        assert result["estimated_size_bytes"] is None

    def test_rejects_live_stream(self):
        from yuu_clip.url_import import ImportUrlError, inspect_url
        info = {"title": "Live now", "id": "live1", "is_live": True}
        with mock.patch("yt_dlp.YoutubeDL", return_value=self._mock_ydl(info)):
            with pytest.raises(ImportUrlError, match="still live"):
                inspect_url("https://www.twitch.tv/videos/live1")

    def test_rejects_playlist(self):
        from yuu_clip.url_import import ImportUrlError, inspect_url
        info = {"title": "A playlist", "id": "pl1", "entries": [{"id": "a"}, {"id": "b"}]}
        with mock.patch("yt_dlp.YoutubeDL", return_value=self._mock_ydl(info)):
            with pytest.raises(ImportUrlError, match="single video"):
                inspect_url("https://www.youtube.com/playlist?list=pl1")

    def test_auth_error_maps_to_friendly_message(self):
        import yt_dlp

        from yuu_clip.url_import import ImportUrlError, inspect_url
        error = yt_dlp.utils.DownloadError("ERROR: Private video. Sign in if you've been invited")
        with mock.patch("yt_dlp.YoutubeDL", return_value=self._mock_ydl(raises=error)):
            with pytest.raises(ImportUrlError, match="requires a login"):
                inspect_url("https://www.youtube.com/watch?v=priv")

    def test_generic_extractor_error_maps_to_friendly_message(self):
        import yt_dlp

        from yuu_clip.url_import import ImportUrlError, inspect_url
        error = yt_dlp.utils.DownloadError("ERROR: Unsupported URL format changed")
        with mock.patch("yt_dlp.YoutubeDL", return_value=self._mock_ydl(raises=error)):
            with pytest.raises(ImportUrlError, match="yt-dlp needs"):
                inspect_url("https://www.youtube.com/watch?v=weird")

    def test_rejects_unsupported_host_before_calling_yt_dlp(self):
        from yuu_clip.url_import import ImportUrlError, inspect_url
        with mock.patch("yt_dlp.YoutubeDL") as ydl_cls:
            with pytest.raises(ImportUrlError):
                inspect_url("https://vimeo.com/12345")
            ydl_cls.assert_not_called()


# ---------------------------------------------------------------------------
# Progress-line format / parse round trip
# ---------------------------------------------------------------------------

class TestProgressLineParsing:
    def test_format_and_parse_round_trip_known_size(self):
        from yuu_clip.url_import import format_progress_line, parse_progress_line
        line = format_progress_line({
            "downloaded_bytes": 500_000_000, "total_bytes": 1_200_000_000,
            "speed": 8_800_000, "eta": 151,
        })
        parsed = parse_progress_line(line)
        assert parsed is not None
        assert parsed["percent"] == pytest.approx(41.7, abs=0.1)
        assert parsed["eta"] == "02:31"

    def test_no_eta_variant_parses(self):
        from yuu_clip.url_import import format_progress_line, parse_progress_line
        line = format_progress_line({
            "downloaded_bytes": 100, "total_bytes": 1000, "speed": 50, "eta": None,
        })
        parsed = parse_progress_line(line)
        assert parsed is not None
        assert parsed["eta"] is None
        assert parsed["percent"] == pytest.approx(10.0)

    def test_unknown_size_variant_parses(self):
        from yuu_clip.url_import import format_progress_line, parse_progress_line
        line = format_progress_line({
            "downloaded_bytes": 2_000_000, "total_bytes": None,
            "total_bytes_estimate": None, "speed": 500_000, "eta": None,
        })
        assert "size unknown" in line
        parsed = parse_progress_line(line)
        assert parsed is not None
        assert parsed["percent"] is None
        assert parsed["downloaded"] is not None

    def test_no_speed_variant_parses(self):
        from yuu_clip.url_import import format_progress_line, parse_progress_line
        line = format_progress_line({
            "downloaded_bytes": 10, "total_bytes": 100, "speed": None, "eta": None,
        })
        parsed = parse_progress_line(line)
        assert parsed is not None
        assert parsed["speed"] is None

    def test_non_matching_line_returns_none(self):
        from yuu_clip.url_import import parse_progress_line
        assert parse_progress_line("Assigning tracks...") is None


# ---------------------------------------------------------------------------
# Filename sanitization
# ---------------------------------------------------------------------------

class TestSanitizeImportFilename:
    def test_strips_unsafe_characters(self):
        from yuu_clip.url_import import sanitize_import_filename
        stem = sanitize_import_filename('Crazy "Clutch" Moment: 1v5?!', "vid1")
        assert '"' not in stem
        assert ":" not in stem
        assert "?" not in stem

    def test_emoji_and_unicode_title_falls_back_or_strips_cleanly(self):
        from yuu_clip.url_import import sanitize_import_filename
        stem = sanitize_import_filename("🔥🔥🔥", "vid2")
        assert stem == "video_vid2"

    def test_unicode_letters_are_transliterated_or_dropped_without_crashing(self):
        from yuu_clip.url_import import sanitize_import_filename
        stem = sanitize_import_filename("Café Ünïcode Stream", "vid3")
        assert stem  # non-empty
        assert all(ord(c) < 128 for c in stem)

    def test_collision_appends_video_id(self):
        from yuu_clip.url_import import sanitize_import_filename
        first = sanitize_import_filename("My Stream", "vid4")
        second = sanitize_import_filename("My Stream", "vid5", existing_stems={first})
        assert second != first
        assert "vid5" in second

    def test_no_collision_when_stem_not_in_existing(self):
        from yuu_clip.url_import import sanitize_import_filename
        stem = sanitize_import_filename("Unique Title", "vid6", existing_stems={"something_else"})
        assert stem == "Unique Title"


# ---------------------------------------------------------------------------
# Disk-space guard
# ---------------------------------------------------------------------------

class TestCheckDiskSpace:
    def test_no_op_when_size_unknown(self, tmp_path: Path):
        from yuu_clip.url_import import check_disk_space
        check_disk_space(tmp_path, None)  # must not raise

    def test_raises_when_insufficient_free_space(self, tmp_path: Path, monkeypatch):
        import shutil as shutil_mod

        from yuu_clip.url_import import ImportUrlError, check_disk_space
        fake_usage = mock.MagicMock(free=1_000)
        monkeypatch.setattr(shutil_mod, "disk_usage", lambda _: fake_usage)
        with pytest.raises(ImportUrlError, match="disk space"):
            check_disk_space(tmp_path, estimated_size_bytes=1_000_000)

    def test_passes_when_sufficient_free_space(self, tmp_path: Path, monkeypatch):
        import shutil as shutil_mod

        from yuu_clip.url_import import check_disk_space
        fake_usage = mock.MagicMock(free=10_000_000_000)
        monkeypatch.setattr(shutil_mod, "disk_usage", lambda _: fake_usage)
        check_disk_space(tmp_path, estimated_size_bytes=1_000_000)  # must not raise


# ---------------------------------------------------------------------------
# Metadata sidecar -> source_* columns (via _apply_source_metadata)
# ---------------------------------------------------------------------------

class TestSourceMetadataSidecar:
    def test_sidecar_populates_source_columns_and_seeds_title(self, tmp_path: Path):
        from yuu_clip.db.models import Video
        from yuu_clip.pipeline.ingest import _apply_source_metadata
        from yuu_clip.url_import import _write_source_sidecar

        video_path = tmp_path / "downloaded.mkv"
        video_path.write_bytes(b"")
        _write_source_sidecar(video_path, "https://www.twitch.tv/videos/999", {
            "title": "Scraped Title", "uploader": "StreamerName",
            "upload_date": "2026-05-01", "category": "Just Chatting",
        })

        video = Video(path=str(video_path), filename=video_path.name, status="probed")
        _apply_source_metadata(video, video_path)

        assert video.source_url == "https://www.twitch.tv/videos/999"
        assert video.source_title == "Scraped Title"
        assert video.source_uploader == "StreamerName"
        assert video.source_category == "Just Chatting"
        assert video.source_upload_date == datetime(2026, 5, 1)
        assert video.title_user == "Scraped Title"

    def test_no_sidecar_leaves_source_fields_null(self, tmp_path: Path):
        from yuu_clip.db.models import Video
        from yuu_clip.pipeline.ingest import _apply_source_metadata

        video_path = tmp_path / "local_recording.mkv"
        video_path.write_bytes(b"")
        video = Video(path=str(video_path), filename=video_path.name, status="probed")
        _apply_source_metadata(video, video_path)

        assert video.source_url is None
        assert video.title_user is None

    def test_existing_title_user_is_not_overwritten(self, tmp_path: Path):
        from yuu_clip.db.models import Video
        from yuu_clip.pipeline.ingest import _apply_source_metadata
        from yuu_clip.url_import import _write_source_sidecar

        video_path = tmp_path / "downloaded2.mkv"
        video_path.write_bytes(b"")
        _write_source_sidecar(video_path, "https://youtu.be/abc", {"title": "Scraped"})

        video = Video(path=str(video_path), filename=video_path.name, status="probed")
        video.title_user = "Creator's own title"
        _apply_source_metadata(video, video_path)

        assert video.title_user == "Creator's own title"


# ---------------------------------------------------------------------------
# subprocess_sse's track_active_job option (used by /api/import-url/events so
# any_running reflects a running download)
# ---------------------------------------------------------------------------

class TestSubprocessSseTracksActiveJob:
    def test_active_jobs_incremented_while_running_and_cleared_after(self, tmp_path: Path):
        from yuu_clip.web.sse import subprocess_sse

        ctx = SimpleNamespace(
            analyze_proc=None, active_jobs=0, import_cmd="queued",
            subprocess_procs=set(), counted_procs=set(),
        )
        observed = []

        async def drive():
            response = await subprocess_sse(
                [sys.executable, "-c", "print('hello')"], tmp_path, ctx,
                clear_cmd_attr="import_cmd", track_active_job=True,
            )
            async for _ in response.body_iterator:
                observed.append(ctx.active_jobs)

        asyncio.run(drive())

        assert observed and max(observed) == 1
        assert ctx.active_jobs == 0
        assert ctx.import_cmd is None

    def test_active_jobs_untouched_when_not_tracked(self, tmp_path: Path):
        from yuu_clip.web.sse import subprocess_sse

        ctx = SimpleNamespace(analyze_proc=None, active_jobs=0, subprocess_procs=set())

        async def drive():
            response = await subprocess_sse([sys.executable, "-c", "print('hi')"], tmp_path, ctx)
            async for _ in response.body_iterator:
                pass

        asyncio.run(drive())
        assert ctx.active_jobs == 0


# ---------------------------------------------------------------------------
# subprocess_sse cancel messaging (used by /api/import-url/cancel)
# ---------------------------------------------------------------------------

class TestSubprocessSseCancel:
    def test_cancel_flag_emits_message_and_clears(self, tmp_path: Path):
        from yuu_clip.web.sse import subprocess_sse

        ctx = SimpleNamespace(analyze_proc=None, import_cancelled=True, active_jobs=0, subprocess_procs=set())
        chunks: list[str] = []

        async def drive():
            response = await subprocess_sse(
                [sys.executable, "-c", "print('done')"], tmp_path, ctx,
                cancel_flag_attr="import_cancelled", cancel_message="[Import cancelled]",
            )
            async for chunk in response.body_iterator:
                chunks.append(chunk)

        asyncio.run(drive())
        assert any("[Import cancelled]" in c for c in chunks)
        assert ctx.import_cancelled is False

    def test_stale_flag_not_leaked_without_cancel_attr(self, tmp_path: Path):
        from yuu_clip.web.sse import subprocess_sse

        ctx = SimpleNamespace(analyze_proc=None, import_cancelled=True, active_jobs=0, subprocess_procs=set())
        chunks: list[str] = []

        async def drive():
            response = await subprocess_sse([sys.executable, "-c", "print('done')"], tmp_path, ctx)
            async for chunk in response.body_iterator:
                chunks.append(chunk)

        asyncio.run(drive())
        assert not any("cancelled" in c.lower() for c in chunks)
        assert ctx.import_cancelled is True



# ---------------------------------------------------------------------------
# download_video - the post-download half (extension resolution, sidecar,
# error mapping). yt-dlp is faked; no network, no real media.
# ---------------------------------------------------------------------------

class _FakeYDL:
    """Stands in for yt_dlp.YoutubeDL: writes a file at the resolved outtmpl with a
    chosen extension and fires the registered progress hooks, mimicking a real run."""

    def __init__(self, write_ext: str | None, *, raises: Exception | None = None):
        self._write_ext = write_ext
        self._raises = raises

    def __call__(self, opts):
        self._opts = opts
        return self

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def download(self, urls):
        hooks = self._opts.get("progress_hooks", [])
        for hook in hooks:
            hook({"status": "downloading", "downloaded_bytes": 5, "total_bytes": 10, "speed": 1000})
        if self._raises is not None:
            raise self._raises
        if self._write_ext is not None:
            out = Path(self._opts["outtmpl"].replace("%(ext)s", self._write_ext))
            out.write_bytes(b"media")
        for hook in hooks:
            hook({"status": "finished"})


class TestDownloadVideo:
    _INFO = {
        "title": "Epic Moment", "video_id": "vid123", "uploader": "Streamer",
        "upload_date": "2026-06-15", "category": "Gaming",
        "estimated_size_bytes": None,
    }

    def _patch_common(self, monkeypatch, fake_ydl):
        import yuu_clip.url_import as mod
        monkeypatch.setattr(mod, "inspect_url", lambda url: dict(self._INFO))
        monkeypatch.setattr(mod, "check_disk_space", lambda *a, **k: None)
        monkeypatch.setattr("yt_dlp.YoutubeDL", fake_ydl)
        return mod

    def test_returns_merged_mkv_path_and_writes_sidecar(self, tmp_path, monkeypatch):
        mod = self._patch_common(monkeypatch, _FakeYDL("mkv"))
        result = mod.download_video("https://youtu.be/vid123", tmp_path)
        assert result.suffix == ".mkv"
        assert result.exists()
        assert mod.source_sidecar_path(result).exists()

    def test_resolves_progressive_mp4_when_no_merge_happens(self, tmp_path, monkeypatch):
        """The /best fallback keeps the source .mp4 container - the old hardcoded
        .mkv lookup declared this successful download 'not found'."""
        mod = self._patch_common(monkeypatch, _FakeYDL("mp4"))
        result = mod.download_video("https://youtu.be/vid123", tmp_path)
        assert result.suffix == ".mp4"
        assert result.exists()

    def test_missing_output_after_success_raises(self, tmp_path, monkeypatch):
        mod = self._patch_common(monkeypatch, _FakeYDL(None))
        with pytest.raises(RuntimeError, match="output file was not found"):
            mod.download_video("https://youtu.be/vid123", tmp_path)

    def test_download_error_maps_to_runtime_error(self, tmp_path, monkeypatch):
        import yt_dlp
        error = yt_dlp.utils.DownloadError("ERROR: network unreachable")
        mod = self._patch_common(monkeypatch, _FakeYDL("mkv", raises=error))
        with pytest.raises(RuntimeError):
            mod.download_video("https://youtu.be/vid123", tmp_path)

    def test_sidecar_is_not_mistaken_for_the_media_file(self, tmp_path, monkeypatch):
        mod = self._patch_common(monkeypatch, _FakeYDL("mp4"))
        result = mod.download_video("https://youtu.be/vid123", tmp_path)
        assert not result.name.endswith(mod._SIDECAR_SUFFIX)
        assert result.suffix == ".mp4"

    def test_progress_hook_forwards_lines(self, tmp_path, monkeypatch):
        mod = self._patch_common(monkeypatch, _FakeYDL("mkv"))
        lines: list[str] = []
        mod.download_video("https://youtu.be/vid123", tmp_path, progress_line_cb=lines.append)
        assert any("Merging" in ln for ln in lines)
