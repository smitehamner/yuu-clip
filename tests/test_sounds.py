from __future__ import annotations

# ---------------------------------------------------------------------------
# Notification sounds
# ---------------------------------------------------------------------------

class TestSounds:
    def test_list_returns_builtin_and_custom(self, client):
        r = client.get("/api/sounds")
        assert r.status_code == 200
        data = r.json()
        assert "builtin" in data and "custom" in data
        assert isinstance(data["builtin"], list)
        assert data["custom"] == []  # none uploaded yet

    def test_upload_then_list_and_serve(self, client):
        payload = b"RIFF....WAVEfake"
        up = client.post("/api/sounds/upload?name=mycue.wav", content=payload)
        assert up.status_code == 200
        assert up.json()["name"] == "mycue.wav"

        listing = client.get("/api/sounds").json()
        assert any(s["name"] == "mycue.wav" for s in listing["custom"])

        served = client.get("/api/sounds/file?kind=custom&name=mycue.wav")
        assert served.status_code == 200
        assert served.content == payload
        assert served.headers["content-type"].startswith("audio/")

    def test_upload_rejects_non_audio_extension(self, client):
        r = client.post("/api/sounds/upload?name=evil.exe", content=b"x")
        assert r.status_code == 400

    def test_upload_rejects_empty_body(self, client):
        r = client.post("/api/sounds/upload?name=empty.wav", content=b"")
        assert r.status_code == 400

    def test_file_rejects_path_traversal(self, client):
        r = client.get("/api/sounds/file?kind=custom&name=..%2f..%2fproject.db")
        assert r.status_code == 400

    def test_file_unknown_kind(self, client):
        r = client.get("/api/sounds/file?kind=bogus&name=x.wav")
        assert r.status_code == 400

    def test_missing_custom_file_is_404(self, client):
        r = client.get("/api/sounds/file?kind=custom&name=nope.wav")
        assert r.status_code == 404

    def test_delete_custom_sound(self, client):
        client.post("/api/sounds/upload?name=todelete.wav", content=b"data")
        r = client.request("DELETE", "/api/sounds/custom?name=todelete.wav")
        assert r.status_code == 200
        listing = client.get("/api/sounds").json()
        assert all(s["name"] != "todelete.wav" for s in listing["custom"])
