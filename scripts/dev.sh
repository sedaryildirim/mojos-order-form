#!/usr/bin/env bash
# Starts both apps for local development:
#   web            http://localhost:8080   (static launcher + ordering form)
#   gp-calculator  http://localhost:3000   (needs DATABASE_URL in apps/gp-calculator/.env)
# Ctrl+C stops both.
set -euo pipefail
cd "$(dirname "$0")/.."

python3 -m http.server 8080 --directory apps/web >/dev/null 2>&1 &
WEB_PID=$!
trap 'kill "$WEB_PID" 2>/dev/null || true' EXIT
echo "web:            http://localhost:8080"
echo "gp-calculator:  http://localhost:3000"

cd apps/gp-calculator
npm run dev
