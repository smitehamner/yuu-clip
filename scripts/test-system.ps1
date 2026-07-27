# test-system.ps1 - run the full-stack system test tier.
#
# Thin wrapper over `yuu-dev test-system` (the cross-platform runner in
# yuu_clip/dev/tests.py), kept as the plan's named deliverable and for muscle
# memory. The yuu-dev command owns the pytest invocation and the quiet-by-default
# logging (writes .test-logs/test-system-last.log + .test-logs/test-system-last-summary.log),
# mirroring test-api.
#
# The system tier drives the real analyze pipeline against a generated fixture
# video (Whisper + LLM stubbed) plus the FastAPI TestClient. It needs ffmpeg on
# PATH (guard-skips otherwise) and no live server. It is a pre-release gate, not a
# per-edit check, and is excluded from `yuu-dev test-api`'s default selection.
#
# Any extra args are passed straight through to pytest, e.g.:
#   .\scripts\test-system.ps1 --detailed
#   .\scripts\test-system.ps1 tests/system/test_uc_reel.py

yuu-dev test-system @args
exit $LASTEXITCODE
