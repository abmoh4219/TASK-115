#!/bin/sh
set -e

echo "========================================"
echo "  HarborPoint Test Suite"
echo "========================================"

FAILED=0

echo ""
echo "--- Unit Tests ---"
npx jest unit_tests/ --forceExit --passWithNoTests --ci 2>&1 || FAILED=1

echo ""
echo "--- Integration Tests ---"
npx jest api_tests/ --runInBand --forceExit --passWithNoTests --ci 2>&1 || FAILED=1

echo ""
echo "========================================"
if [ $FAILED -eq 0 ]; then
  echo "  ALL TESTS PASSED"
else
  echo "  SOME TESTS FAILED"
fi
echo "========================================"

exit $FAILED
