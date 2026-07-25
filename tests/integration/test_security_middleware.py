"""Loopback request-provenance guard (web/security.py).

Proves the middleware rejects the browser-borne attack classes from the
localhost threat-model review (CSRF against side-effectful endpoints, DNS
rebinding) while leaving legitimate same-origin browser traffic and every
non-browser caller (CLI, desktop probe, the in-process TestClient) working.
"""
from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from yuu_clip.web.app import create_app

# A representative side-effectful GET (launches an LLM rescore job) - the CSRF
# surface the guard exists to protect. It must 403 at the middleware, before the
# handler ever runs, so no job starts.
_SIDE_EFFECT_GET = "/api/videos/1/rescore-clips"


def _browser(host: str = "127.0.0.1:8080", site: str = "same-origin") -> dict:
    return {"Host": host, "Sec-Fetch-Site": site}


class TestNonBrowserCallersPass:
    def test_plain_request_has_no_browser_metadata(self, client: TestClient):
        # No Sec-Fetch-Site, no Origin: the CLI / desktop probe / TestClient path.
        assert client.get("/api/status").status_code == 200

    def test_host_is_not_checked_without_browser_metadata(self, client: TestClient):
        # A non-browser client may send any Host; rebinding is a browser attack.
        assert client.get("/api/status", headers={"Host": "anything.example"}).status_code == 200


class TestLegitimateBrowserTrafficPasses:
    def test_same_origin_passes(self, client: TestClient):
        assert client.get("/api/status", headers=_browser()).status_code == 200

    def test_direct_navigation_passes(self, client: TestClient):
        # Sec-Fetch-Site: none is a bookmark / address-bar load.
        assert client.get("/api/status", headers=_browser(site="none")).status_code == 200

    def test_localhost_host_passes(self, client: TestClient):
        assert client.get("/api/status", headers=_browser(host="localhost:8080")).status_code == 200

    def test_origin_fallback_same_host_passes(self, client: TestClient):
        # Older browser with no Sec-Fetch-Site: Origin host is loopback.
        headers = {"Host": "127.0.0.1:8080", "Origin": "http://127.0.0.1:8080"}
        assert client.get("/api/status", headers=headers).status_code == 200


class TestCrossSiteRejected:
    def test_cross_site_fetch_rejected(self, client: TestClient):
        resp = client.get("/api/status", headers=_browser(site="cross-site"))
        assert resp.status_code == 403

    def test_side_effectful_get_blocked_cross_site(self, client: TestClient):
        # The core CSRF case: an <img>/fetch from a hostile page can no longer
        # kick off a job. 403 comes from the middleware, so no rescore launches.
        resp = client.get(_SIDE_EFFECT_GET, headers=_browser(site="cross-site"))
        assert resp.status_code == 403

    def test_cross_origin_fallback_rejected(self, client: TestClient):
        headers = {"Host": "127.0.0.1:8080", "Origin": "http://evil.example"}
        assert client.get("/api/status", headers=headers).status_code == 403


class TestDnsRebindingRejected:
    def test_attacker_host_rejected_despite_same_origin(self, client: TestClient):
        # Rebinding: browser thinks it's same-origin, but Host is the attacker's.
        resp = client.get("/api/status", headers=_browser(host="evil.example:8080"))
        assert resp.status_code == 403

    def test_ipv6_loopback_host_passes(self, client: TestClient):
        resp = client.get("/api/status", headers=_browser(host="[::1]:8080"))
        assert resp.status_code == 200


class TestNonLoopbackBind:
    """allowed_hosts=None models a deliberate --host 0.0.0.0 bind: the Host
    allowlist is off (any LAN address the user typed is fine) but the cross-site
    guard still applies."""

    def _client(self, project_dir: Path) -> TestClient:
        return TestClient(create_app(project_dir, allowed_hosts=None))

    def test_lan_host_passes_when_allowlist_disabled(self, project_dir: Path):
        resp = self._client(project_dir).get(
            "/api/status", headers=_browser(host="192.168.1.50:8080")
        )
        assert resp.status_code == 200

    def test_cross_site_still_rejected_when_allowlist_disabled(self, project_dir: Path):
        resp = self._client(project_dir).get(
            "/api/status", headers=_browser(host="192.168.1.50:8080", site="cross-site")
        )
        assert resp.status_code == 403
