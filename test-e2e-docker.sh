#!/usr/bin/env bash
# Tests de bout en bout, autonomes : démarre l'API et le front (vite) sur une base JETABLE, lance
# Playwright, puis arrête tout — y compris quand un test échoue.
#
# Utilisé tel quel dans l'image `playwright.Dockerfile` (npm run test:e2e:docker), et en local
# (npm run test:e2e:full). Les arguments sont transmis à Playwright :
#   npm run test:e2e:full -- -g "UNO"
set -uo pipefail
cd "$(dirname "$0")"

# Jamais la vraie base : sans ça, chaque passage remplissait server/data/db.sqlite3 de groupes de test.
export MINDMATCH_DB_PATH="${MINDMATCH_DB_PATH:-$(mktemp -d)/e2e.sqlite3}"
export PORT="${PORT:-3001}"
WEB_PORT="${WEB_PORT:-5173}"
export TEST_BASE_URL="${TEST_BASE_URL:-http://localhost:$WEB_PORT}"

# npx / tsx lancent des processus enfants : tuer le PID direct laissait tourner le vrai serveur.
kill_tree() {
  local pid=$1
  for child in $(pgrep -P "$pid" 2>/dev/null); do kill_tree "$child"; done
  kill "$pid" 2>/dev/null || true
}
pids=()
cleanup() { for pid in "${pids[@]}"; do kill_tree "$pid"; done; }
trap cleanup EXIT INT TERM

wait_for() {
  for _ in $(seq 1 60); do
    curl -s -o /dev/null "$1" && return 0
    sleep 1
  done
  echo "Pas de réponse de $1 après 60 s" >&2
  return 1
}

npx tsx server/index.ts &
pids+=($!)
npx vite --host 0.0.0.0 --port "$WEB_PORT" --strictPort &
pids+=($!)

wait_for "http://localhost:$PORT/api/spotify/config" || exit 1
wait_for "$TEST_BASE_URL/" || exit 1

npx playwright test --project=chromium "$@"
