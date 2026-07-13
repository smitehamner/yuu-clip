import datetime
import types

from yuu_clip.db.models import (
    SPEAKER_COLOR_PALETTE,
    ProjectVoice,
    Speaker,
    latest_track_transcript,
)


def _tx(created_at, tx_id):
    return types.SimpleNamespace(id=tx_id, created_at=created_at)


class TestLatestTrackTranscript:
    def test_returns_none_when_no_transcripts(self):
        track = types.SimpleNamespace(transcripts=[])
        assert latest_track_transcript(track) is None

    def test_returns_single_transcript(self):
        only = _tx(datetime.datetime(2024, 1, 1), tx_id=7)
        track = types.SimpleNamespace(transcripts=[only])
        assert latest_track_transcript(track) is only

    def test_picks_most_recently_created(self):
        older = _tx(datetime.datetime(2024, 1, 1), tx_id=1)
        newer = _tx(datetime.datetime(2024, 6, 1), tx_id=2)
        track = types.SimpleNamespace(transcripts=[older, newer])
        assert latest_track_transcript(track) is newer

    def test_created_at_wins_over_list_and_id_order(self):
        # Deliberate contract: selection is by created_at, not row id or list
        # position. A newer transcript with a lower id must still win.
        newer_low_id = _tx(datetime.datetime(2024, 6, 1), tx_id=1)
        older_high_id = _tx(datetime.datetime(2024, 1, 1), tx_id=99)
        track = types.SimpleNamespace(transcripts=[newer_low_id, older_high_id])
        assert latest_track_transcript(track) is newer_low_id


class TestProjectVoiceDisplay:
    def test_named_shows_name(self):
        assert ProjectVoice(name="Alex", display_index=1).display_name == "Alex"

    def test_unnamed_falls_back_to_person_index(self):
        assert ProjectVoice(name=None, display_index=3).display_name == "Person 3"

    def test_color_uses_user_pick_when_set(self):
        assert ProjectVoice(display_index=1, color="#123456").display_color == "#123456"

    def test_color_falls_back_to_palette_by_index(self):
        assert ProjectVoice(display_index=2).display_color == SPEAKER_COLOR_PALETTE[1]

    def test_color_palette_wraps_on_high_index(self):
        n = len(SPEAKER_COLOR_PALETTE)
        assert ProjectVoice(display_index=n + 1).display_color == SPEAKER_COLOR_PALETTE[0]


class TestSpeakerDisplayNameResolvesThroughVoice:
    def test_linked_named_voice_overrides_speaker(self):
        # The whole point of a Person: naming it applies everywhere, even over the
        # Speaker's own name.
        voice = ProjectVoice(name="Jordan", display_index=1)
        speaker = Speaker(display_index=5, name="Speaker-local", confirmed=True)
        speaker.global_voice = voice
        assert speaker.display_name == "Jordan"

    def test_linked_unnamed_voice_falls_through_to_speaker_name(self):
        voice = ProjectVoice(name=None, display_index=1)
        speaker = Speaker(display_index=5, name="Casey", confirmed=True)
        speaker.global_voice = voice
        assert speaker.display_name == "Casey"

    def test_no_voice_uses_confirmed_name(self):
        assert Speaker(display_index=2, name="Sam", confirmed=True).display_name == "Sam"

    def test_no_voice_unconfirmed_name_uses_fallback(self):
        speaker = Speaker(display_index=4, name="Guess", confirmed=False)
        assert speaker.display_name == "Speaker 4"

    def test_no_voice_no_name_uses_fallback(self):
        assert Speaker(display_index=7).display_name == "Speaker 7"


class TestSpeakerDisplayColorResolvesThroughVoice:
    def test_linked_speaker_takes_person_color(self):
        # One identity, one caption colour everywhere: a linked Speaker uses the Person's
        # colour so recolouring the Person flows to every member's captions.
        voice = ProjectVoice(display_index=1, color="#123456")
        speaker = Speaker(display_index=5, color="#abcdef")
        speaker.global_voice = voice
        assert speaker.display_color == "#123456"

    def test_linked_speaker_uses_person_palette_when_person_uncolored(self):
        voice = ProjectVoice(display_index=2, color=None)
        speaker = Speaker(display_index=5)
        speaker.global_voice = voice
        assert speaker.display_color == SPEAKER_COLOR_PALETTE[1]  # Person's palette slot

    def test_unlinked_speaker_uses_own_color(self):
        assert Speaker(display_index=1, color="#abcdef").display_color == "#abcdef"

    def test_unlinked_unset_uses_speaker_palette(self):
        assert Speaker(display_index=3).display_color == SPEAKER_COLOR_PALETTE[2]
