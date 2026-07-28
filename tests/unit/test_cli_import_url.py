"""yuu_clip/cli/import_url.py - the [Imported] marker line the web UI's SSE
stream parses (see analyze.js's parseImportDoneLine / _IMPORT_DONE_RE)."""
from __future__ import annotations

from yuu_clip.cli.import_url import import_url_cmd


def test_imported_marker_starts_a_fresh_line(tmp_path, monkeypatch):
    """yt-dlp's own progress-bar output can leave the pipe mid-line (a bare \\r
    with no trailing \\n, from its in-place terminal overwrite). If the
    [Imported] marker were appended straight onto that unterminated line, the
    web UI's anchored ^[Imported] regex would silently fail to match and the
    downloaded path would be lost (found 2026-07-27, VM release test) - a
    leading \\n guarantees the marker always starts its own line regardless of
    what came before it. Checks the exact print() call, not merged stdout text -
    surrounding Rich console.print calls already inject enough newlines that a
    plain substring-in-captured-output check would pass even without the fix."""
    import yuu_clip.cli.import_url as mod
    import yuu_clip.url_import as url_import_mod

    downloaded = tmp_path / "downloads" / "some clip.mkv"
    monkeypatch.setattr(url_import_mod, "download_video", lambda url, dest_dir, progress_line_cb: downloaded)
    monkeypatch.setattr("yuu_clip.log.configure_logging", lambda project_dir: None)
    monkeypatch.setattr("yuu_clip.config.project_downloads_dir", lambda project_dir: tmp_path / "downloads")

    calls = []
    monkeypatch.setattr(mod, "print", lambda *args, **kwargs: calls.append(args[0] if args else ""), raising=False)

    import_url_cmd(url="https://youtu.be/fake", project=tmp_path)

    marker_calls = [c for c in calls if "[Imported]" in c]
    assert len(marker_calls) == 1
    assert marker_calls[0] == f"\n[Imported] {downloaded}"
