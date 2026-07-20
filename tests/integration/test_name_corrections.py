"""Transcript name-correction tests (Plan 09).

The matcher (`find_name_corrections`) is the bulk of the value and is a pure function
 -  most tests exercise it directly. A smaller set covers the scan/apply routes via the
TestClient, including span-drift handling and the caption-edit bookkeeping.
"""
from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace

from yuu_clip.db.models import (
    AudioTrack,
    ClipCandidate,
    Speaker,
    Transcript,
    TranscriptSegment,
    Video,
    make_session,
)
from yuu_clip.scoring.textmatch import (
    LexiconName,
    extract_character_names,
    find_name_corrections,
)


def _seg(seg_id: int, text: str, speaker_id=None) -> SimpleNamespace:
    return SimpleNamespace(id=seg_id, text=text, speaker_id=speaker_id)


class TestMatcher:
    def test_you_becomes_yuu_for_other_speaker(self):
        lexicon = [LexiconName("Yuu", owner_speaker_id=1)]
        corrections = find_name_corrections(
            [_seg(1, "You were incredible there!", speaker_id=2)], lexicon
        )
        assert len(corrections) == 1
        assert (corrections[0].token, corrections[0].suggested) == ("You", "Yuu")
        assert corrections[0].common_word is True
        assert corrections[0].speaker_scoped is True

    def test_own_speaker_line_is_excluded(self):
        lexicon = [LexiconName("Yuu", owner_speaker_id=1)]
        corrections = find_name_corrections(
            [_seg(1, "You know I always deliver.", speaker_id=1)], lexicon
        )
        assert corrections == []

    def test_lowercase_common_word_not_matched(self):
        # A common-word candidate must be Capitalized in context to qualify.
        lexicon = [LexiconName("Yuu", owner_speaker_id=1)]
        assert find_name_corrections([_seg(1, "you got this", speaker_id=2)], lexicon) == []

    def test_word_boundary_safety_your_does_not_match_yuu(self):
        lexicon = [LexiconName("Yuu", owner_speaker_id=1)]
        assert find_name_corrections([_seg(1, "Is that your sword?", speaker_id=2)], lexicon) == []

    def test_normal_token_cutoff_catches_clear_misspelling(self):
        lexicon = [LexiconName("Shawn", owner_speaker_id=None)]
        corrections = find_name_corrections([_seg(1, "Shaun opened the door", speaker_id=2)], lexicon)
        assert [(c.token, c.suggested) for c in corrections] == [("Shaun", "Shawn")]
        assert corrections[0].common_word is False

    def test_unattributed_segment_scanned_but_flagged(self):
        lexicon = [LexiconName("Yuu", owner_speaker_id=1)]
        corrections = find_name_corrections([_seg(1, "You did great", speaker_id=None)], lexicon)
        assert len(corrections) == 1
        assert corrections[0].speaker_scoped is False

    def test_common_function_word_never_matches_character_name(self):
        # "The" at a sentence start must not flag against a character named "Thane".
        lexicon = [LexiconName("Thane", owner_speaker_id=None)]
        assert find_name_corrections([_seg(1, "The dragon flew off", speaker_id=2)], lexicon) == []

    def test_short_common_word_not_matched_to_much_longer_name(self):
        # "All" (capitalized at sentence starts) must not flood against "Sally".
        lexicon = [LexiconName("Sally", owner_speaker_id=None)]
        assert find_name_corrections([_seg(1, "All of them ran", speaker_id=2)], lexicon) == []

    def test_exact_name_is_not_flagged(self):
        lexicon = [LexiconName("Yuu", owner_speaker_id=1)]
        assert find_name_corrections([_seg(1, "Yuu, over here!", speaker_id=2)], lexicon) == []

    def test_empty_lexicon_returns_nothing(self):
        assert find_name_corrections([_seg(1, "You did great", speaker_id=2)], []) == []

    def test_token_offsets_point_at_the_word(self):
        lexicon = [LexiconName("Yuu", owner_speaker_id=1)]
        text = "Hey, You were amazing"
        correction = find_name_corrections([_seg(1, text, speaker_id=2)], lexicon)[0]
        assert text[correction.token_start:correction.token_end] == "You"


class TestLexiconExtraction:
    def test_extracts_capitalized_multichar_tokens(self):
        names = extract_character_names("Yuu the ranger, and Mara. plus lord Vex")
        assert names == ["Yuu", "Mara", "Vex"]

    def test_dedupes_case_insensitively_keeping_first_casing(self):
        assert extract_character_names("Mara fought MARA and mara") == ["Mara"]

    def test_ignores_short_and_lowercase_tokens(self):
        assert extract_character_names("a Bo of go Ada") == ["Ada"]

    def test_empty_text_is_empty(self):
        assert extract_character_names("") == []


def _project_with_transcript(tmp_path: Path, texts_and_speakers, *, context=None) -> Path:
    """Seed a project DB with one recording, a track, speakers, and a transcript.

    ``texts_and_speakers`` is a list of (text, speaker_display_index_or_None). Two
    confirmed speakers always exist - Yuu (index 1) and Mara (index 2) - so the
    lexicon carries both names regardless of which lines are attributed.
    """
    data = tmp_path / ".yuu-clip"
    data.mkdir()
    (data / "exports").mkdir()
    session = make_session(data / "project.db")

    video = Video(path=str(tmp_path / "s.mkv"), filename="s.mkv", status="done", duration_ms=600_000)
    if context:
        video.context_names_json = json.dumps(["fantasy-rp"])
    session.add(video)
    session.flush()

    speaker_by_index: dict[int, Speaker] = {}
    for idx, name in ((1, "Yuu"), (2, "Mara")):
        speaker = Speaker(video_id=video.id, name=name, display_index=idx, confirmed=True)
        session.add(speaker)
        session.flush()
        speaker_by_index[idx] = speaker

    track = AudioTrack(video_id=video.id, stream_index=1, label="combined", do_transcribe=True)
    session.add(track)
    session.flush()
    tx = Transcript(audio_track_id=track.id, model_name="base")
    session.add(tx)
    session.flush()
    for i, (text, idx) in enumerate(texts_and_speakers):
        session.add(TranscriptSegment(
            transcript_id=tx.id, start_ms=i * 1000, end_ms=(i + 1) * 1000, text=text,
            speaker_id=speaker_by_index[idx].id if idx is not None else None,
        ))
    session.commit()
    session.close()

    if context:
        from yuu_clip.contexts import save_contexts
        save_contexts(tmp_path, {"fantasy-rp": {
            "display_name": "Fantasy RP", "your_characters": "Kaelen the mage",
            "other_characters": "the villain Vex", "setting": "", "notes": "",
        }})
    return tmp_path


class TestScanRoute:
    def test_scan_groups_by_pattern(self, tmp_path: Path):
        from fastapi.testclient import TestClient

        from yuu_clip.web.app import create_app

        project = _project_with_transcript(tmp_path, [
            ("You were amazing", 2),
            ("I think You won", 2),
            ("Yuu, watch out", 2),
        ])
        client = TestClient(create_app(project))
        resp = client.post("/api/videos/1/name-corrections/scan")
        assert resp.status_code == 200
        body = resp.json()
        assert body["scanned_segments"] == 3
        groups = body["groups"]
        assert len(groups) == 1
        assert (groups[0]["token"], groups[0]["suggested"], groups[0]["count"]) == ("You", "Yuu", 2)
        assert groups[0]["instances"][0]["speaker"] == "Mara"

    def test_scan_lexicon_includes_context_characters(self, tmp_path: Path):
        from fastapi.testclient import TestClient

        from yuu_clip.web.app import create_app

        project = _project_with_transcript(tmp_path, [("hello world", 2)], context=True)
        client = TestClient(create_app(project))
        body = client.post("/api/videos/1/name-corrections/scan").json()
        assert "Kaelen" in body["lexicon"]
        assert "Vex" in body["lexicon"]
        assert "Yuu" in body["lexicon"]  # confirmed speaker name


class TestApplyRoute:
    def test_apply_updates_text_and_stamps_edited(self, tmp_path: Path):
        from fastapi.testclient import TestClient

        from yuu_clip.web.app import create_app

        project = _project_with_transcript(tmp_path, [("You were amazing", 2)])
        # A clip overlapping the segment picks up transcript_edited_at.
        session = make_session(project / ".yuu-clip" / "project.db")
        session.add(ClipCandidate(video_id=1, start_ms=0, end_ms=2000, score_overall=0.5))
        session.commit()
        session.close()

        client = TestClient(create_app(project))
        scan = client.post("/api/videos/1/name-corrections/scan").json()
        inst = scan["groups"][0]["instances"][0]
        resp = client.post("/api/videos/1/name-corrections/apply", json={"corrections": [{
            "segment_id": inst["segment_id"], "token_start": inst["token_start"],
            "token_end": inst["token_end"], "token": inst["token"], "replacement": "Yuu",
        }]})
        assert resp.status_code == 200
        body = resp.json()
        assert body["applied"] == 1
        assert body["results"][0]["applied"] is True

        session = make_session(project / ".yuu-clip" / "project.db")
        seg = session.query(TranscriptSegment).one()
        clip = session.query(ClipCandidate).one()
        video = session.query(Video).one()
        assert seg.text == "Yuu were amazing"
        assert clip.transcript_edited_at is not None
        # B16: drives the video-level "SRT sidecar is stale" badge.
        assert video.transcript_edited_at is not None
        session.close()

    def test_apply_reports_drift_per_item(self, tmp_path: Path):
        from fastapi.testclient import TestClient

        from yuu_clip.web.app import create_app

        project = _project_with_transcript(tmp_path, [("You were amazing", 2)])
        client = TestClient(create_app(project))
        # token no longer matches what's at the span → text_changed, not applied.
        resp = client.post("/api/videos/1/name-corrections/apply", json={"corrections": [{
            "segment_id": 1, "token_start": 0, "token_end": 3, "token": "Xxx", "replacement": "Yuu",
        }]})
        assert resp.status_code == 200
        body = resp.json()
        assert body["applied"] == 0
        assert body["results"][0]["error"] == "text_changed"

        session = make_session(project / ".yuu-clip" / "project.db")
        assert session.query(TranscriptSegment).one().text == "You were amazing"
        # Nothing actually changed - no clip and no video should be flagged stale.
        assert session.query(Video).one().transcript_edited_at is None
        session.close()

    def test_apply_scan_apply_is_idempotent_second_time_finds_nothing(self, tmp_path: Path):
        from fastapi.testclient import TestClient

        from yuu_clip.web.app import create_app

        project = _project_with_transcript(tmp_path, [("You were amazing", 2)])
        client = TestClient(create_app(project))
        inst = client.post("/api/videos/1/name-corrections/scan").json()["groups"][0]["instances"][0]
        client.post("/api/videos/1/name-corrections/apply", json={"corrections": [{
            "segment_id": inst["segment_id"], "token_start": inst["token_start"],
            "token_end": inst["token_end"], "token": inst["token"], "replacement": "Yuu",
        }]})
        rescan = client.post("/api/videos/1/name-corrections/scan").json()
        assert rescan["groups"] == []
