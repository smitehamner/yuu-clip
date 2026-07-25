"""Loopback request-provenance guard.

yuu-clip is an unauthenticated API bound to 127.0.0.1, so the loopback bind is the
whole trust boundary. A web browser the user has open can send requests to that
socket from a hostile page, which leaves two holes a loopback bind alone does not
close:

- **Cross-site request forgery.** Another origin can fire state-changing requests
  (side-effectful GETs, no-body/query POSTs) at the API. The browser blocks it from
  *reading* the response, but the request still executes server-side. We reject a
  browser request whose ``Sec-Fetch-Site`` says ``cross-site`` (or, on a browser
  too old to send it, whose ``Origin`` host is not one of ours).
- **DNS rebinding.** An attacker domain rebound to 127.0.0.1 arrives same-origin
  with an attacker ``Host`` header, defeating the same-origin policy outright. We
  reject a browser request whose ``Host`` is not a loopback name.

Both checks key on browser fetch-metadata (``Sec-Fetch-Site`` / ``Origin``). A
request carrying neither is not a browser fetch - the desktop shell's own HTTP
probe, the ``yuu-dev`` CLI, curl, the in-process ``TestClient`` - and passes
through untouched. Rebinding and CSRF are definitionally browser attacks, so gating
on browser-ness loses no coverage while leaving every headless caller working.

Known gap: a browser old enough to send neither ``Sec-Fetch-Site`` nor an ``Origin``
on a top-level navigation would slip the Host check. Every current browser sends
``Sec-Fetch-Site`` on every request, so this is an ancient-client edge, recorded not
defended.
"""
from __future__ import annotations

from typing import Optional
from urllib.parse import urlparse

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from yuu_clip.log import get_logger

_log = get_logger(__name__)

# Host names a loopback-bound server legitimately answers to.
LOOPBACK_HOSTS = frozenset({"127.0.0.1", "localhost", "::1"})

# Sec-Fetch-Site values that mean "not a cross-site sender": the app's own origin,
# a same-site subdomain, or a direct user action (address bar, bookmark).
_ALLOWED_SEC_FETCH_SITE = frozenset({"same-origin", "same-site", "none"})


def bind_host_policy(host: str) -> tuple[Optional[frozenset], Optional[str]]:
    """Security policy for a ``yuu-dev serve --host`` value.

    Returns ``(allowed_hosts, warning)``:
    - a loopback bind gets the strict Host allowlist (anti DNS-rebinding) and no
      warning;
    - any other bind exposes an unauthenticated API to the network, so the Host
      allowlist is disabled (we cannot enumerate the LAN address the user will
      type) and a loud warning is returned for the caller to surface.
    """
    if host in LOOPBACK_HOSTS:
        return LOOPBACK_HOSTS, None
    warning = (
        f"binding to {host} exposes yuu-clip to your whole network with NO "
        "password - anyone who can reach this machine can open, edit, and export "
        "your projects. Use 127.0.0.1 unless you specifically intend network access."
    )
    return None, warning


def _bare_host(authority: str) -> str:
    """Host name from a ``Host``-header authority, without port or IPv6 brackets."""
    value = authority.strip().lower()
    if value.startswith("["):  # IPv6 literal, e.g. "[::1]:8080"
        end = value.find("]")
        return value[1:end] if end != -1 else value
    return value.rsplit(":", 1)[0] if ":" in value else value


class LoopbackGuardMiddleware:
    """Reject browser requests that are cross-site or carry a non-loopback Host.

    Pure ASGI (not ``BaseHTTPMiddleware``) so an accepted request is forwarded
    with zero interference - critical for the app's many streaming SSE responses.
    """

    def __init__(self, app: ASGIApp, allowed_hosts: Optional[frozenset]) -> None:
        # allowed_hosts is None for a deliberate non-loopback ``--host`` bind: the
        # Host allowlist is disabled (we cannot enumerate the LAN address the user
        # will type), but the cross-site check still applies.
        self.app = app
        self.allowed_hosts = allowed_hosts

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        headers = {
            key.decode("latin-1").lower(): value.decode("latin-1")
            for key, value in scope["headers"]
        }
        reason = self._reject_reason(headers)
        if reason is not None:
            _log.warning(
                "Blocked request (%s) to %s %s",
                reason, scope.get("method", "?"), scope.get("path", "?"),
            )
            response = JSONResponse(
                {"detail": "Request blocked: this API only accepts requests from "
                           "the yuu-clip app itself, not from another web page."},
                status_code=403,
            )
            await response(scope, receive, send)
            return
        await self.app(scope, receive, send)

    def _reject_reason(self, headers: dict) -> Optional[str]:
        sec_fetch_site = headers.get("sec-fetch-site")
        origin = headers.get("origin")
        if sec_fetch_site is None and origin is None:
            return None  # not a browser fetch (CLI / desktop probe / curl / tests)
        return self._bad_host(headers.get("host", "")) or self._bad_provenance(
            sec_fetch_site, origin
        )

    def _bad_host(self, host_header: str) -> Optional[str]:
        if self.allowed_hosts is None:
            return None
        if _bare_host(host_header) in self.allowed_hosts:
            return None
        return f"non-loopback Host {host_header!r}"

    def _bad_provenance(self, sec_fetch_site: Optional[str], origin: Optional[str]) -> Optional[str]:
        if sec_fetch_site is not None:
            if sec_fetch_site in _ALLOWED_SEC_FETCH_SITE:
                return None
            return f"Sec-Fetch-Site {sec_fetch_site!r}"
        # No Sec-Fetch-Site (older browser): fall back to the Origin host. With the
        # Host allowlist disabled (non-loopback bind) we cannot know our own host,
        # so we cannot reject on Origin either.
        if self.allowed_hosts is None:
            return None
        origin_host = (urlparse(origin).hostname or "").lower()
        if origin_host in self.allowed_hosts:
            return None
        return f"cross-origin {origin!r}"
