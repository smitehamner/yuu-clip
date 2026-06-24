#!/usr/bin/env bash
# pin-deps.sh — generate requirements.lock with SHA256 hashes
# Run this whenever you want to update or initially generate the lockfile.
#
# Usage:
#   ./scripts/pin-deps.sh              # pin all deps
#   ./scripts/pin-deps.sh --upgrade    # upgrade all to latest allowed versions
#
# Prerequisites: run from the repo root with your venv active.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT"

echo "==> Installing pip-tools..."
pip install --quiet "pip-tools>=7.4.0"

echo "==> Compiling requirements.lock with SHA256 hashes..."
pip-compile \
  --generate-hashes \
  --output-file requirements.lock \
  --strip-extras \
  --no-emit-index-url \
  --no-emit-trusted-host \
  "$@" \
  requirements.in

echo ""
echo "==> Done. requirements.lock written."
echo ""
echo "    To install in a clean environment:"
echo "      pip install --require-hashes -r requirements.lock"
echo ""
echo "    Commit requirements.lock to version control."
echo "    It pins every transitive dependency and their SHA256 hashes."
