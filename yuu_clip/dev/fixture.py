"""``yuu-dev fixture-project`` - stand up a seeded throwaway project for the UI suite.

The Playwright ``tests/ui/`` tier drives a *live* server (``YUU_TEST_URL``); by
default that is the repo owner's real dev project. A contributor (or CI) has no
analyzed recording, so this command builds a disposable project - a tiny
ffmpeg-generated clip plus a seeded DB (a handful of clips AND scenes) - that the
UI suite can run against with no personal data present. Serve it with
``yuu-dev serve --project <dir>``.

``seed_project_db`` is the single seeding routine shared with
``tests/integration/conftest.py`` so the two never drift; ``with_scenes=False``
reproduces the integration seed exactly (three clips), and the fixture builder
opts into the extra scene rows the merged Clips+Scenes view needs.
"""
from __future__ import annotations

import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path

import typer

from yuu_clip.dev._base import REPO_ROOT, app, console

DEFAULT_FIXTURE_DIR = REPO_ROOT / "build" / "fixture-project"
MEDIA_FILENAME = "session.mp4"

# (score_overall, status) for the seeded clips. Kept byte-identical to the
# original integration seed so its assertions (e.g. clip_count == 3) hold.
_CLIP_ROWS = [(0.85, "pending"), (0.60, "approved"), (0.20, "rejected")]
# Scenes (kind='scene') - longer windows, added only for the fixture project so
# the merged list, SCENE badge, kind chips, and per-kind counts have real data.
_SCENE_ROWS = [(0.75, "pending"), (0.45, "approved")]


def _seed_rows(session, video_path: str, *, with_scenes: bool) -> None:
    from yuu_clip.db.models import AudioTrack, ClipCandidate, Video

    video = Video(
        path=video_path,
        filename=Path(video_path).name,
        status="done",
        duration_ms=600_000,
    )
    session.add(video)
    session.flush()

    session.add(AudioTrack(
        video_id=video.id,
        stream_index=1,
        label="combined",
        do_transcribe=True,
        do_score=True,
        relevance_weight=1.5,
    ))
    session.flush()

    scored_at = datetime.now(timezone.utc)
    for i, (score, status) in enumerate(_CLIP_ROWS):
        session.add(ClipCandidate(
            video_id=video.id,
            start_ms=i * 60_000,
            end_ms=(i + 1) * 60_000,
            score_overall=score,
            score_funny=score * 0.9,
            score_dramatic=score * 0.5,
            score_action=score * 0.3,
            score_visual=score * 0.7,
            score_laugh=score * 0.4,
            description=f"Test clip {i + 1}",
            status=status,
            scored_at=scored_at,
        ))

    if with_scenes:
        for i, (score, status) in enumerate(_SCENE_ROWS):
            session.add(ClipCandidate(
                video_id=video.id,
                kind="scene",
                start_ms=i * 120_000,
                end_ms=i * 120_000 + 180_000,
                score_overall=score,
                score_funny=score * 0.4,
                score_dramatic=score * 0.9,
                score_action=score * 0.6,
                score_visual=score * 0.8,
                score_laugh=score * 0.2,
                description=f"Test scene {i + 1}",
                status=status,
                scored_at=scored_at,
            ))

    session.commit()


def seed_project_db(project_dir: Path, video_path: str, *, with_scenes: bool = False) -> None:
    """Create the ``.yuu-clip`` project structure and seed a demo DB in place.

    Seeds one done video, a combined audio track, and three clips; add the two
    scene rows with ``with_scenes=True``. Shared by the integration ``project_dir``
    fixture (scenes off) and the fixture-project builder (scenes on).
    """
    from yuu_clip.db.models import make_session

    data = project_dir / ".yuu-clip"
    data.mkdir(parents=True, exist_ok=True)
    (data / "exports").mkdir(exist_ok=True)
    (data / "audio").mkdir(exist_ok=True)

    session = make_session(data / "project.db")
    try:
        _seed_rows(session, video_path, with_scenes=with_scenes)
    finally:
        session.close()


def _generate_media(dest: Path) -> bool:
    """Generate a few-second silent synthetic AV clip with ffmpeg. Returns success.

    Best-effort: the seeded DB is usable without it (``media_url`` returns null
    with 200 for an un-exported clip, so the UI smoke suite still passes), so a
    contributor without ffmpeg is not blocked - they just get no playable source.
    """
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        console.print("[yellow]ffmpeg not on PATH - seeding the DB without a playable media file.[/yellow]")
        return False
    cmd = [
        ffmpeg, "-y",
        "-f", "lavfi", "-i", "testsrc=duration=3:size=320x240:rate=10",
        "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=16000",
        "-shortest", "-pix_fmt", "yuv420p", str(dest),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        console.print(f"[yellow]ffmpeg failed to generate the fixture clip; seeding without media.[/yellow]\n{result.stderr[-500:]}")
        return False
    return True


def build_fixture_project(dest: Path, *, force: bool = False) -> Path:
    """Build (or rebuild) a seeded throwaway project at ``dest`` and return it."""
    if dest.exists() and force:
        shutil.rmtree(dest)
    dest.mkdir(parents=True, exist_ok=True)

    media_path = dest / MEDIA_FILENAME
    _generate_media(media_path)
    seed_project_db(dest, str(media_path), with_scenes=True)
    return dest


@app.command("fixture-project")
def fixture_project(
    dir: Path = typer.Option(DEFAULT_FIXTURE_DIR, "--dir", help="Where to build the seeded project."),
    force: bool = typer.Option(False, "--force", help="Wipe and rebuild if the directory already exists."),
) -> None:
    """Build a seeded throwaway project so the UI suite can run with no personal data.

    Then serve it and run the smoke tier:

      yuu-dev serve --project <dir>
      yuu-dev test-ui --smoke
    """
    dest = dir.resolve()
    if dest.exists() and not force:
        console.print(f"[yellow]{dest} already exists. Pass --force to rebuild.[/yellow]")
        raise typer.Exit(1)

    build_fixture_project(dest, force=force)
    console.print(f"[green]Seeded fixture project at[/green] {dest}")
    console.print("Serve it and run the smoke tier:")
    console.print(f"  [cyan]yuu-dev serve --project {dest}[/cyan]")
    console.print("  [cyan]yuu-dev test-ui --smoke[/cyan]")
