import datetime
import types

from yuu_clip.db.models import latest_track_transcript


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
