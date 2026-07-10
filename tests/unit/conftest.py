"""Unit tier - deliberately empty of DB / server fixtures.

Unit tests must pass regardless of repo/project/machine state: no ``project_dir``
or ``client`` fixture, no live server, no real installed-package / HF-cache /
global-config reads. Defining none of those fixtures here is the guardrail: a
unit test that references ``project_dir`` or ``client`` raises a fixture error at
collection instead of silently reaching into integration territory. Only the
root ``isolate_global_config`` fixture is inherited.
"""
from __future__ import annotations
