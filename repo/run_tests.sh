#!/bin/sh
set -e

echo "========================================"
echo "  HarborPoint Test Suite"
echo "========================================"

# Ensure dev dependencies are installed (uses lockfile for determinism)
if [ ! -d node_modules ] || [ ! -d node_modules/jest-preset-angular ]; then
  echo "Installing dependencies..."
  npm ci --include=dev
fi

FAILED=0

echo ""
echo "--- Unit Tests ---"
npx --no jest unit_tests/ --forceExit --passWithNoTests --ci 2>&1 || FAILED=1

echo ""
echo "--- Integration Tests ---"
npx --no jest api_tests/ --runInBand --forceExit --passWithNoTests --ci 2>&1 || FAILED=1

echo ""
echo "========================================"
if [ $FAILED -eq 0 ]; then
  echo "  ALL TESTS PASSED"
else
  echo "  SOME TESTS FAILED"
fi
echo "========================================"

exit $FAILED
