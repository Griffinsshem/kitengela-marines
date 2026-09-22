#!/usr/bin/env bash
# Runs every quality gate. Any failure aborts immediately.
set -euo pipefail

cd "$(dirname "$0")"

echo "== api =="
(
  cd api
  source .venv/bin/activate
  ruff check .
  ruff format --check .
  mypy app
  pytest
)

echo "== web =="
(
  cd web
  npm run lint
  npm run typecheck
  npm test
  npm run build
)

echo
echo "All gates passed."
