# Feature-map - shared HTTPS verification for direct urllib downloads
#   Siblings: update_check.py, analyze/framing.py, cli/models.py
"""Certifi-backed SSL context for the handful of call sites that use
urllib.request directly instead of requests/huggingface_hub.

requests and huggingface_hub bundle certifi's CA file and verify against it
regardless of the OS trust store, so those downloads work even on a machine
whose Windows root-certificate store hasn't been refreshed yet (a fresh VM,
a sandboxed image with no outbound access to Windows Update). Plain
urllib.request.urlopen() falls back to ssl.create_default_context(), which
loads certs from the OS store instead - on such a machine that raises
CERTIFICATE_VERIFY_FAILED even though the same host is reachable over
requests. Route direct urlopen calls through this context so their trust
behavior matches the rest of the app's downloads.
"""
from __future__ import annotations

import ssl
import urllib.request
from typing import Optional, Union

import certifi

_ssl_context = ssl.create_default_context(cafile=certifi.where())


def urlopen_verified(
    url_or_request: Union[str, urllib.request.Request],
    timeout: Optional[float] = None,
):
    return urllib.request.urlopen(url_or_request, timeout=timeout, context=_ssl_context)
