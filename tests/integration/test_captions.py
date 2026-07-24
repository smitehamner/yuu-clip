"""Captions: client-bound route tests.

Pure subtitles.py/labeler.py/overlap.py logic moved to tests/unit/
(test_captions.py, test_labeler.py, test_overlap.py)."""
from __future__ import annotations

# ---------------------------------------------------------------------------
# Captions VTT endpoint
# ---------------------------------------------------------------------------

class TestCaptionsVTT:
    def _first_clip(self, client):
        vid_id = client.get("/api/videos").json()[0]["id"]
        return client.get(f"/api/videos/{vid_id}/clips").json()[0]

    def test_captions_vtt_404_without_srt(self, client):
        clip = self._first_clip(client)
        r = client.get(f"/api/clips/{clip['id']}/captions.vtt")
        assert r.status_code == 404

    def test_captions_vtt_returns_vtt_format(self, client, project_dir):
        clip = self._first_clip(client)
        export_dir = project_dir / ".yuu-clip" / "exports"
        start_hms_dashes = clip["start_hms"].replace(":", "-")
        srt_file = export_dir / f"session_clip{clip['id']}_{start_hms_dashes}.srt"
        srt_file.write_text(
            "1\n00:00:01,000 --> 00:00:03,500\nHello world\n\n",
            encoding="utf-8",
        )
        r = client.get(f"/api/clips/{clip['id']}/captions.vtt")
        assert r.status_code == 200
        assert "text/vtt" in r.headers["content-type"]
        assert r.text.startswith("WEBVTT")
        assert "00:00:01.000 --> 00:00:03.500" in r.text


# ---------------------------------------------------------------------------
# Bug-hunt: clip description contains raw HTML characters (XSS regression)
# ---------------------------------------------------------------------------

class TestClipDescriptionRawText:
    """The API must return raw (unescaped) description text.
    The JS layer is responsible for escaping it before inserting into innerHTML.
    These tests document that contract so a regression (e.g. API double-escaping
    or JS forgetting to call escHtml) can be caught.
    """

    def _seed_clip_with_description(self, project_dir, description: str) -> int:
        """Insert a clip with the given description and return its id."""
        from yuu_clip.db.models import ClipCandidate, make_session
        db_path = project_dir / ".yuu-clip" / "project.db"
        session = make_session(db_path)
        try:
            vid_id = session.query(ClipCandidate).first().video_id
            clip = ClipCandidate(
                video_id=vid_id,
                start_ms=900_000,
                end_ms=960_000,
                score_overall=0.5,
                description=description,
                status="pending",
            )
            session.add(clip)
            session.commit()
            return clip.id
        finally:
            session.close()

    def test_description_with_html_chars_returned_unescaped(self, client, project_dir):
        """API must return raw HTML characters in description, not entity-encoded.
        The JavaScript renderDetail() must call escHtml(clip.description) before
        writing to innerHTML - this test locks in the API contract so a regression
        on either side is visible.
        """
        raw = '<script>alert("xss")</script>'
        clip_id = self._seed_clip_with_description(project_dir, raw)
        r = client.get(f"/api/clips/{clip_id}")
        assert r.status_code == 200
        # API returns raw text - the JS must escape it
        assert r.json()["description"] == raw

    def test_description_with_quotes_returned_unescaped(self, client, project_dir):
        """Quotes in LLM-generated descriptions must survive the API round-trip."""
        raw = 'He said "hello" & she said \'bye\''
        clip_id = self._seed_clip_with_description(project_dir, raw)
        r = client.get(f"/api/clips/{clip_id}")
        assert r.status_code == 200
        assert r.json()["description"] == raw
