"""Export presets (roadmap plan 07): client-bound CRUD routes and the real
ffmpeg encode integration tier.

Pure bitrate math, preset validation, builtin-preset invariants, and
resolve_preset moved to tests/unit/test_export_presets.py."""
from __future__ import annotations

import shutil
import subprocess

import pytest

import yuu_clip.config as _config_module


@pytest.fixture(autouse=True)
def _isolated_global_config(monkeypatch, tmp_path_factory):
    """Custom Export presets are stored in *global* config (a user preference,
    not project data - see export_presets.py). Every test in this file that
    exercises the /api/export-presets routes writes through Config.save_global(),
    which defaults to the real per-machine config directory - redirect it to a
    throwaway temp dir so these tests never touch (or pollute) the developer's
    actual global config.json."""
    isolated_dir = tmp_path_factory.mktemp("global_cfg")
    monkeypatch.setattr(_config_module, "_global_config_dir", lambda: isolated_dir)


# ---------------------------------------------------------------------------
# /api/export-presets CRUD routes
# ---------------------------------------------------------------------------

class TestExportPresetRoutes:
    def test_list_includes_builtins_and_empty_custom_by_default(self, client):
        data = client.get("/api/export-presets").json()
        assert {p["name"] for p in data["builtins"]} == {"youtube-1080p", "discord-10mb", "tiktok-9x16"}
        assert data["custom"] == []

    def test_create_round_trip(self, client):
        body = {"label": "My Twitch Clip", "container": "mp4", "height": 720, "crf": 22, "audio_kbps": 128}
        created = client.post("/api/export-presets", json=body).json()
        assert created["name"] == "my-twitch-clip"
        assert created["label"] == "My Twitch Clip"

        listed = client.get("/api/export-presets").json()
        assert any(p["name"] == "my-twitch-clip" for p in listed["custom"])

    def test_create_dedupes_generated_name(self, client):
        body = {"label": "Dup", "container": "mp4", "crf": 20}
        first = client.post("/api/export-presets", json=body).json()
        second = client.post("/api/export-presets", json=body).json()
        assert first["name"] == "dup"
        assert second["name"] == "dup-2"

    def test_create_rejects_invalid_preset(self, client):
        res = client.post("/api/export-presets", json={"label": "Bad", "container": "avi", "crf": 20})
        assert res.status_code == 400

    def test_update_preserves_name_and_changes_fields(self, client):
        created = client.post("/api/export-presets", json={"label": "Edit Me", "container": "mp4", "crf": 20}).json()
        name = created["name"]

        updated = client.put(f"/api/export-presets/{name}", json={
            "label": "Edited Label", "container": "mkv", "crf": 25,
        }).json()
        assert updated["name"] == name
        assert updated["label"] == "Edited Label"
        assert updated["container"] == "mkv"

    def test_update_unknown_name_404s(self, client):
        res = client.put("/api/export-presets/does-not-exist", json={"label": "X", "container": "mp4", "crf": 20})
        assert res.status_code == 404

    def test_delete_custom_preset(self, client):
        created = client.post("/api/export-presets", json={"label": "Delete Me", "container": "mp4", "crf": 20}).json()
        res = client.delete(f"/api/export-presets/{created['name']}")
        assert res.status_code == 200
        assert created["name"] not in {p["name"] for p in client.get("/api/export-presets").json()["custom"]}

    def test_cannot_delete_builtin(self, client):
        res = client.delete("/api/export-presets/youtube-1080p")
        assert res.status_code == 400

    def test_delete_unknown_custom_404s(self, client):
        assert client.delete("/api/export-presets/does-not-exist").status_code == 404

    def test_delete_a_preset_a_prior_export_used_degrades_gracefully(self, client, project_dir):
        """A clip's clip_exports row records the preset name it was exported with
        (export/render.py::_record_clip_export) with no FK back to the preset - so
        deleting the preset afterward must not corrupt or hide that clip's export
        history, and a NEW export attempt referencing the now-gone preset must fail
        with a clear 400, not a crash."""
        from yuu_clip.db.models import ClipCandidate, ClipExport, make_session

        created = client.post(
            "/api/export-presets", json={"label": "Delete Me", "container": "mp4", "crf": 20},
        ).json()
        preset_name = created["name"]

        db = make_session(project_dir / ".yuu-clip" / "project.db")
        clip_id = db.query(ClipCandidate).first().id
        db.add(ClipExport(
            clip_id=clip_id, preset_name=preset_name,
            path=str(project_dir / ".yuu-clip" / "exports" / "clip.mp4"),
            container="mp4",
        ))
        db.commit()
        db.close()

        assert client.delete(f"/api/export-presets/{preset_name}").status_code == 200
        assert preset_name not in {p["name"] for p in client.get("/api/export-presets").json()["custom"]}

        # The clip's export history still reflects the (now-dangling) preset name
        # instead of erroring or silently dropping the row.
        detail = client.get(f"/api/clips/{clip_id}")
        assert detail.status_code == 200
        export_rows = detail.json()["exports"]
        assert any(row["preset_name"] == preset_name for row in export_rows)

        # A fresh export attempt against the deleted preset degrades to a plain
        # 400, not a 500 or a silent fallback to some other preset.
        res = client.get(f"/api/clips/{clip_id}/export?preset={preset_name}")
        assert res.status_code == 400
        assert preset_name in res.json()["detail"]


# ---------------------------------------------------------------------------
# Real ffmpeg encode integration - skipped if ffmpeg isn't on PATH. Slow: each
# case runs an actual (tiny, synthetic) two-pass or CRF encode.
# ---------------------------------------------------------------------------

requires_ffmpeg = pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg not on PATH")


@pytest.fixture()
def tiny_source_video(tmp_path):
    """A 3-second, 1440p synthetic test video generated by ffmpeg's lavfi source
    (no real recording needed) - big enough to exercise the scale-down guard."""
    path = tmp_path / "source.mp4"
    subprocess.run(
        [
            "ffmpeg", "-y", "-f", "lavfi", "-i", "testsrc=size=2560x1440:rate=10:duration=3",
            "-f", "lavfi", "-i", "sine=frequency=440:duration=3",
            "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac",
            str(path),
        ],
        capture_output=True, check=True,
    )
    return path


@requires_ffmpeg
class TestPresetEncodeIntegration:
    def _probe_height(self, path):
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-select_streams", "v:0",
             "-show_entries", "stream=height", "-of", "csv=p=0", str(path)],
            capture_output=True, text=True, check=True,
        )
        return int(out.stdout.strip())

    def test_youtube_preset_scales_down_to_1080(self, tiny_source_video, tmp_path):
        from yuu_clip.analyze.extract import export_clip_with_preset
        from yuu_clip.export.presets import BUILTIN_PRESETS

        preset = next(p for p in BUILTIN_PRESETS if p.name == "youtube-1080p")
        output = tmp_path / "out.mp4"
        export_clip_with_preset(tiny_source_video, 0, 2000, output, preset)

        assert output.exists()
        assert self._probe_height(output) <= 1080

    def test_discord_preset_stays_near_target_size(self, tiny_source_video, tmp_path):
        from yuu_clip.analyze.extract import export_clip_with_preset
        from yuu_clip.export.presets import BUILTIN_PRESETS

        preset = next(p for p in BUILTIN_PRESETS if p.name == "discord-10mb")
        output = tmp_path / "out.mp4"
        export_clip_with_preset(tiny_source_video, 0, 2000, output, preset)

        size_mb = output.stat().st_size / (1024 * 1024)
        # Two-pass bitrate targeting is approximate for very short clips (container
        # overhead dominates); generous tolerance keeps this a smoke test, not a
        # precise-bitrate assertion.
        assert size_mb <= preset.target_size_mb * 1.5

    def test_never_upscales_a_smaller_source(self, tmp_path):
        from yuu_clip.analyze.extract import export_clip_with_preset
        from yuu_clip.export.presets import ExportPreset

        small_source = tmp_path / "small.mp4"
        subprocess.run(
            [
                "ffmpeg", "-y", "-f", "lavfi", "-i", "testsrc=size=640x360:rate=10:duration=2",
                "-c:v", "libx264", "-preset", "ultrafast",
                str(small_source),
            ],
            capture_output=True, check=True,
        )
        preset = ExportPreset(name="youtube-1080p", label="YouTube 1080p", container="mp4",
                               height=1080, crf=18, audio_kbps=192)
        output = tmp_path / "out.mp4"
        export_clip_with_preset(small_source, 0, 1500, output, preset)

        assert self._probe_height(output) == 360  # unchanged, never upscaled to 1080
