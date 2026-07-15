"""Character CRUD route tests + context-delete cascade.

A Character is a structured world-context lore entity (name, lore, 0.0-1.0 score_boost)
keyed to a JSON context by context_slug. It is an optional overlay: deleting a Character
(or its whole context) nulls any linking Person's character_id but never touches the
Person's own name or voiceprint.
"""
from __future__ import annotations

from pathlib import Path

from yuu_clip.db.models import Character, ProjectVoice, make_session


class _Fixtures:
    def _db(self, project_dir: Path):
        return make_session(project_dir / ".yuu-clip" / "project.db")

    def _mint_person(self, db, *, name="Alex", display_index=1) -> ProjectVoice:
        voice = ProjectVoice(name=name, display_index=display_index, confirmed=True)
        db.add(voice)
        db.flush()
        return voice

    def _make_context(self, client, slug="my-world"):
        resp = client.post("/api/contexts", json={"context_id": slug, "display_name": "My World"})
        assert resp.status_code == 200
        return slug


class TestCreateCharacter(_Fixtures):
    def test_create_and_list(self, client):
        created = client.post(
            "/api/contexts/fantasy-rp/characters",
            json={"name": "Alara", "lore": "A rogue elf.", "score_boost": 0.3},
        )
        assert created.status_code == 200
        body = created.json()
        assert body["name"] == "Alara"
        assert body["lore"] == "A rogue elf."
        assert body["score_boost"] == 0.3
        assert body["context_slug"] == "fantasy-rp"

        listed = client.get("/api/contexts/fantasy-rp/characters").json()
        assert [c["name"] for c in listed] == ["Alara"]

    def test_unknown_context_404(self, client):
        resp = client.post("/api/contexts/no-such-world/characters", json={"name": "Alara"})
        assert resp.status_code == 404

    def test_empty_name_400(self, client):
        resp = client.post("/api/contexts/fantasy-rp/characters", json={"name": "   "})
        assert resp.status_code == 400

    def test_score_boost_is_clamped(self, client):
        high = client.post(
            "/api/contexts/fantasy-rp/characters", json={"name": "Over", "score_boost": 5.0}
        ).json()
        low = client.post(
            "/api/contexts/fantasy-rp/characters", json={"name": "Under", "score_boost": -2.0}
        ).json()
        assert high["score_boost"] == 1.0
        assert low["score_boost"] == 0.0

    def test_blank_lore_stored_as_empty(self, client):
        body = client.post(
            "/api/contexts/fantasy-rp/characters", json={"name": "Alara", "lore": "  "}
        ).json()
        assert body["lore"] == ""


class TestUpdateCharacter(_Fixtures):
    def test_update_round_trips(self, client):
        cid = client.post(
            "/api/contexts/fantasy-rp/characters", json={"name": "Alara", "score_boost": 0.1}
        ).json()["id"]
        resp = client.put(
            f"/api/characters/{cid}",
            json={"name": "Alara the Bold", "lore": "Now a knight.", "score_boost": 0.8},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["name"] == "Alara the Bold"
        assert body["lore"] == "Now a knight."
        assert body["score_boost"] == 0.8

    def test_update_missing_404(self, client):
        assert client.put("/api/characters/9999", json={"name": "X"}).status_code == 404

    def test_update_empty_name_400(self, client):
        cid = client.post("/api/contexts/fantasy-rp/characters", json={"name": "Alara"}).json()["id"]
        assert client.put(f"/api/characters/{cid}", json={"name": ""}).status_code == 400

    def test_partial_update_leaves_other_fields(self, client):
        cid = client.post(
            "/api/contexts/fantasy-rp/characters",
            json={"name": "Alara", "lore": "keep me", "score_boost": 0.4},
        ).json()["id"]
        body = client.put(f"/api/characters/{cid}", json={"score_boost": 0.9}).json()
        assert body["lore"] == "keep me"
        assert body["name"] == "Alara"
        assert body["score_boost"] == 0.9


class TestDeleteCharacter(_Fixtures):
    def test_delete_removes_character(self, client):
        cid = client.post("/api/contexts/fantasy-rp/characters", json={"name": "Alara"}).json()["id"]
        assert client.delete(f"/api/characters/{cid}").status_code == 200
        assert client.get("/api/contexts/fantasy-rp/characters").json() == []

    def test_delete_missing_404(self, client):
        assert client.delete("/api/characters/9999").status_code == 404

    def test_delete_nulls_linked_person(self, client, project_dir):
        cid = client.post("/api/contexts/fantasy-rp/characters", json={"name": "Alara"}).json()["id"]
        db = self._db(project_dir)
        voice = self._mint_person(db)
        voice.character_id = cid
        db.commit()
        voice_id = voice.id
        db.close()

        resp = client.delete(f"/api/characters/{cid}")
        assert resp.json()["unlinked_people"] == 1

        db = self._db(project_dir)
        try:
            reloaded = db.get(ProjectVoice, voice_id)
            assert reloaded.character_id is None
            # The Person's own identity is untouched.
            assert reloaded.name == "Alex"
        finally:
            db.close()


class TestListAllCharacters(_Fixtures):
    def test_flat_list_tags_context_name(self, client):
        client.post("/api/contexts/fantasy-rp/characters", json={"name": "Alara"})
        rows = client.get("/api/characters").json()
        assert len(rows) == 1
        assert rows[0]["context_name"] == "Fantasy RP"


class TestLinkPersonToCharacter(_Fixtures):
    def _person_and_character(self, client, project_dir):
        cid = client.post("/api/contexts/fantasy-rp/characters", json={"name": "Alara"}).json()["id"]
        db = self._db(project_dir)
        voice = self._mint_person(db)
        db.commit()
        voice_id = voice.id
        db.close()
        return voice_id, cid

    def test_link_sets_character(self, client, project_dir):
        voice_id, cid = self._person_and_character(client, project_dir)
        resp = client.post(f"/api/voices/{voice_id}/character", json={"character_id": cid})
        assert resp.status_code == 200
        assert resp.json()["character"] == {"id": cid, "name": "Alara", "context_slug": "fantasy-rp"}

        db = self._db(project_dir)
        try:
            assert db.get(ProjectVoice, voice_id).character_id == cid
        finally:
            db.close()

    def test_link_shows_in_voice_list(self, client, project_dir):
        voice_id, cid = self._person_and_character(client, project_dir)
        client.post(f"/api/voices/{voice_id}/character", json={"character_id": cid})
        voices = client.get("/api/voices").json()
        linked = next(v for v in voices if v["id"] == voice_id)
        assert linked["character"]["name"] == "Alara"

    def test_clear_link(self, client, project_dir):
        voice_id, cid = self._person_and_character(client, project_dir)
        client.post(f"/api/voices/{voice_id}/character", json={"character_id": cid})
        resp = client.post(f"/api/voices/{voice_id}/character", json={"character_id": None})
        assert resp.status_code == 200
        assert resp.json()["character"] is None

        db = self._db(project_dir)
        try:
            reloaded = db.get(ProjectVoice, voice_id)
            assert reloaded.character_id is None
            assert reloaded.name == "Alex"  # identity untouched
        finally:
            db.close()

    def test_link_unknown_character_404(self, client, project_dir):
        voice_id, _ = self._person_and_character(client, project_dir)
        assert client.post(f"/api/voices/{voice_id}/character", json={"character_id": 9999}).status_code == 404

    def test_link_unknown_person_404(self, client):
        assert client.post("/api/voices/9999/character", json={"character_id": None}).status_code == 404

    def test_person_with_no_link_reports_null_character(self, client, project_dir):
        db = self._db(project_dir)
        self._mint_person(db)
        db.commit()
        db.close()
        voices = client.get("/api/voices").json()
        assert voices[0]["character"] is None


class TestContextDeleteCascade(_Fixtures):
    def test_deleting_context_deletes_characters_and_unlinks(self, client, project_dir):
        slug = self._make_context(client)
        cid = client.post(f"/api/contexts/{slug}/characters", json={"name": "Alara"}).json()["id"]
        db = self._db(project_dir)
        voice = self._mint_person(db)
        voice.character_id = cid
        db.commit()
        voice_id = voice.id
        db.close()

        assert client.delete(f"/api/contexts/{slug}").status_code == 200

        db = self._db(project_dir)
        try:
            assert db.get(Character, cid) is None
            assert db.get(ProjectVoice, voice_id).character_id is None
        finally:
            db.close()
