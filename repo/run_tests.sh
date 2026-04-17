#!/bin/sh
set -e

# ─── Dependency check ────────────────────────────────────────────
if ! command -v docker >/dev/null 2>&1; then
  echo ""
  echo "ERROR: Docker is not installed."
  echo "Install Docker at: https://docs.docker.com/get-docker/"
  echo ""
  exit 1
fi

echo "========================================"
echo "  HarborPoint Test Suite"
echo "========================================"

FAILED=0

# ─── 1. Unit tests ───────────────────────────────────────────────
echo ""
echo "--- Unit Tests ---"
docker compose --profile test run --rm --build test || FAILED=1

# ─── 2. E2E tests (headless, app starts automatically) ──────────
echo ""
echo "--- E2E Tests (headless) ---"
docker compose --profile e2e up --build --abort-on-container-exit --exit-code-from e2e || FAILED=1
docker compose --profile e2e down --remove-orphans 2>/dev/null || true

# ─── Summary ─────────────────────────────────────────────────────
echo ""
echo "========================================"
if [ $FAILED -eq 0 ]; then
  echo "  ALL TESTS PASSED"
else
  echo "  SOME TESTS FAILED"
fi
echo "========================================"

exit $FAILED
