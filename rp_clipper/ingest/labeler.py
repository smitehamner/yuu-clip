"""
Interactive track labeling.

Presents the user with a Rich table of detected audio streams and
lets them assign a label to each one.  Profiles can be saved and
re-applied to future videos that share the same track layout.
"""
from __future__ import annotations

from typing import Optional

from rich.console import Console
from rich.prompt import Confirm, IntPrompt, Prompt
from rich.table import Table

from rp_clipper.config import (
    DEFAULT_SKIP_SCORE,
    DEFAULT_SKIP_TRANSCRIBE,
    LABEL_DESCRIPTIONS,
    LABEL_WEIGHTS,
    TRACK_LABELS,
    load_profiles,
    save_profile,
)
from rp_clipper.ingest.probe import VideoInfo

console = Console()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def label_tracks(
    video_info: VideoInfo,
    profile_name: Optional[str] = None,
) -> list[dict]:
    """
    Return a list of assignment dicts, one per audio stream:

        {
            "stream_index": int,     # container stream index (from ffprobe)
            "label": str,            # one of TRACK_LABELS
            "weight": float,
            "do_transcribe": bool,
            "do_score": bool,        # include in audio energy scoring
        }

    If *profile_name* is given and exists, it is applied without prompting.
    If the video has only one audio track, it is auto-labeled "combined".
    Otherwise the user is prompted interactively.
    """
    streams = video_info.audio_streams

    # --- single track: auto-label as combined ---
    if len(streams) == 1:
        s = streams[0]
        console.print(
            f"  [dim]Single audio track detected — labeling as[/dim] [bold]combined[/bold]"
        )
        return [{
            "stream_index": s.stream_index,
            "label": "combined",
            "weight": LABEL_WEIGHTS["combined"],
            "do_transcribe": True,
            "do_score": True,
        }]

    # --- apply saved profile if requested ---
    if profile_name:
        result = _apply_profile(profile_name, streams)
        if result:
            return result
        console.print(
            f"  [yellow]Profile '{profile_name}' not found or track count mismatch "
            f"— falling back to interactive labeling.[/yellow]"
        )

    # --- interactive labeling ---
    return _label_interactive(video_info)


# ---------------------------------------------------------------------------
# Interactive labeling
# ---------------------------------------------------------------------------

def _label_interactive(video_info: VideoInfo) -> list[dict]:
    streams = video_info.audio_streams
    profiles = load_profiles()

    # Show track table
    console.print()
    _print_stream_table(video_info)

    # Offer to use a saved profile
    if profiles:
        profile_keys = list(profiles.keys())
        console.print("\n  [bold]Saved profiles:[/bold]")
        for i, name in enumerate(profile_keys, 1):
            p = profiles[name]
            console.print(f"    [{i}] {name}  ({p['num_tracks']} tracks)")
        console.print(f"    [0] Label manually")

        choice = IntPrompt.ask(
            "  Use a saved profile?",
            default=0,
        )
        if 1 <= choice <= len(profile_keys):
            result = _apply_profile(profile_keys[choice - 1], streams)
            if result:
                _print_assignment_summary(result)
                return result
            console.print("  [yellow]Track count mismatch — labeling manually.[/yellow]")

    # Label each track
    console.print()
    _print_label_menu()

    assignments: list[dict] = []
    for i, s in enumerate(streams):
        title = s.title_tag or f"stream {s.stream_index}"
        console.print(f"\n  [bold]Track {i + 1}[/bold]  ({title})")

        choice = IntPrompt.ask(
            "    Label",
            default=5 if len(streams) == 1 else _guess_label_index(s),
        )
        choice = max(1, min(choice, len(TRACK_LABELS)))
        label = TRACK_LABELS[choice - 1]

        # Transcription
        if label in DEFAULT_SKIP_TRANSCRIBE:
            do_transcribe = Confirm.ask(
                f"    Transcribe this track? (default: no for {label})",
                default=False,
            )
        else:
            do_transcribe = True

        # Scoring (energy analysis)
        if label in DEFAULT_SKIP_SCORE:
            do_score = Confirm.ask(
                f"    Include in energy scoring? (default: no for {label})",
                default=False,
            )
        else:
            do_score = Confirm.ask(
                "    Include in energy scoring?",
                default=True,
            )

        assignments.append({
            "stream_index": s.stream_index,
            "label": label,
            "weight": LABEL_WEIGHTS[label],
            "do_transcribe": do_transcribe,
            "do_score": do_score,
        })

    _print_assignment_summary(assignments)

    # Offer to save as a profile
    if Confirm.ask("\n  Save these assignments as a profile for future videos?", default=False):
        name = Prompt.ask("  Profile name").strip()
        if name:
            # Store position-relative assignments (not absolute stream indices)
            positional = [
                {
                    "stream_position": idx,
                    "label": a["label"],
                    "do_transcribe": a["do_transcribe"],
                    "do_score": a["do_score"],
                }
                for idx, a in enumerate(assignments)
            ]
            save_profile(name, positional)
            console.print(f"  [green]Profile '{name}' saved.[/green]")

    return assignments


# ---------------------------------------------------------------------------
# Profile application
# ---------------------------------------------------------------------------

def _apply_profile(name: str, streams) -> Optional[list[dict]]:
    profiles = load_profiles()
    if name not in profiles:
        return None

    profile = profiles[name]
    expected = profile.get("num_tracks", 0)
    if expected != len(streams):
        return None  # mismatch — caller falls back to interactive

    assignments: list[dict] = []
    for pos_assign in profile["assignments"]:
        pos = pos_assign["stream_position"]
        s = streams[pos]
        label = pos_assign["label"]
        assignments.append({
            "stream_index": s.stream_index,
            "label": label,
            "weight": LABEL_WEIGHTS.get(label, 1.0),
            "do_transcribe": pos_assign.get("do_transcribe", True),
            "do_score": pos_assign.get("do_score", label not in DEFAULT_SKIP_SCORE),
        })

    console.print(f"  [green]Applied profile '{name}'[/green]")
    _print_assignment_summary(assignments)
    return assignments


# ---------------------------------------------------------------------------
# Display helpers
# ---------------------------------------------------------------------------

def _print_stream_table(video_info: VideoInfo) -> None:
    table = Table(
        show_header=True,
        header_style="bold cyan",
        border_style="dim",
    )
    table.add_column("#", style="dim", width=3)
    table.add_column("Stream idx", width=10)
    table.add_column("Codec", width=8)
    table.add_column("Rate", width=9)
    table.add_column("Ch", width=4)
    table.add_column("Title tag")

    for i, s in enumerate(video_info.audio_streams):
        table.add_row(
            str(i + 1),
            str(s.stream_index),
            s.codec_name,
            f"{s.sample_rate // 1000}kHz",
            str(s.channels),
            s.title_tag or "[dim]—[/dim]",
        )

    console.print(table)


def _print_label_menu() -> None:
    console.print("  [bold]Available labels:[/bold]")
    for i, label in enumerate(TRACK_LABELS, 1):
        w = LABEL_WEIGHTS[label]
        desc = LABEL_DESCRIPTIONS[label]
        console.print(f"    [{i}] [cyan]{label:<20}[/cyan] {desc}  [dim](weight {w})[/dim]")


def _print_assignment_summary(assignments: list[dict]) -> None:
    console.print()
    for a in assignments:
        transcribe_str = "[green]transcribe[/green]" if a["do_transcribe"] else "[dim]skip transcription[/dim]"
        score_str      = "[green]score[/green]"      if a.get("do_score", True) else "[dim]skip scoring[/dim]"
        console.print(
            f"  stream {a['stream_index']}  ->  [bold]{a['label']}[/bold]"
            f"  (weight {a['weight']})  {transcribe_str}  {score_str}"
        )


def _guess_label_index(stream) -> int:
    """Heuristic: if the stream title contains 'mic' or 'voice', guess player_voice."""
    title = (stream.title_tag or "").lower()
    if any(kw in title for kw in ("mic", "voice", "vocal", "player")):
        return 1  # player_voice
    if any(kw in title for kw in ("desktop", "game", "sound", "audio")):
        return 4  # combined or game_sounds — default to combined
    return 5  # unlabeled
