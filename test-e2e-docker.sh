#!/bin/bash
set -e
npx vite --host 0.0.0.0 --port 5173 &
SERVER_PID=$!
for i in {1..30}; do
  if curl -s http://localhost:5173/ > /dev/null; then break; fi
  sleep 1
done
curl -s http://localhost:5173/ > /dev/null || { echo "Dev server did not start"; kill $SERVER_PID 2>/dev/null; exit 1; }
npx tsx server/index.ts &
SERVER2_PID=$!
for i in {1..30}; do
  if curl -s http://localhost:3001/ > /dev/null; then break; fi
  sleep 1
done
curl -s http://localhost:3001/ > /dev/null || { echo "API server did not start"; kill $SERVER_PID $SERVER2_PID 2>/dev/null; exit 1; }
npx playwright test --project=chromium
EXIT_CODE=$?
kill $SERVER_PID $SERVER2_PID 2>/dev/null || true
exit $EXIT_CODE
