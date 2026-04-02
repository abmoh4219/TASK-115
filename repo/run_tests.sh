#!/bin/bash
set -e
echo "=== HarborPoint Test Suite ==="
echo ""
echo "--- Unit Tests ---"
npx jest unit_tests/ --coverage --coverageReporters=text
echo ""
echo "--- Integration Tests ---"
npx jest api_tests/ --runInBand
echo ""
echo "=== All tests complete ==="
