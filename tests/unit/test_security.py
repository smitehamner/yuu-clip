"""Pure helpers behind the loopback request-provenance guard (web/security.py).

The middleware's request-blocking behavior is exercised in
tests/integration/test_security_middleware.py (it needs a TestClient); this
covers the state-independent pieces: Host parsing and the --host bind policy.
"""
from __future__ import annotations

import pytest

from yuu_clip.web.security import LOOPBACK_HOSTS, _bare_host, bind_host_policy


@pytest.mark.parametrize(
    "authority, expected",
    [
        ("127.0.0.1:8080", "127.0.0.1"),
        ("localhost", "localhost"),
        ("LOCALHOST:8080", "localhost"),
        ("[::1]:8080", "::1"),
        ("[::1]", "::1"),
        ("evil.example:8080", "evil.example"),
    ],
)
def test_bare_host_strips_port_and_brackets(authority, expected):
    assert _bare_host(authority) == expected


class TestBindHostPolicy:
    @pytest.mark.parametrize("host", ["127.0.0.1", "localhost", "::1"])
    def test_loopback_bind_gets_allowlist_and_no_warning(self, host):
        allowed_hosts, warning = bind_host_policy(host)
        assert allowed_hosts == LOOPBACK_HOSTS
        assert warning is None

    @pytest.mark.parametrize("host", ["0.0.0.0", "192.168.1.50", "::"])
    def test_non_loopback_bind_disables_allowlist_and_warns(self, host):
        allowed_hosts, warning = bind_host_policy(host)
        assert allowed_hosts is None
        assert warning is not None
        assert "NO password" in warning
        assert host in warning
