#!/usr/bin/env bash
# One-time (and after-pulling) setup: dependencies, env file, database check.
set -euo pipefail
cd "$(dirname "$0")/../apps/gp-calculator"

command -v node >/dev/null || { echo "Node.js is required (https://nodejs.org)"; exit 1; }

# An old checkout symlinked node_modules to another folder; replace it with a real install.
[ -L node_modules ] && rm node_modules
npm ci
npx prisma generate

if [ ! -f .env ] && [ ! -f .env.local ]; then
  cp .env.example .env
  echo "Created apps/gp-calculator/.env from .env.example: set DATABASE_URL in it."
fi

# The test suite refuses to run without a test database URL (it wipes tables).
[ -f .env.test ] || { cp .env.test.example .env.test; echo "Created apps/gp-calculator/.env.test from .env.test.example (database gp_calculator_test)."; }

if command -v pg_isready >/dev/null && pg_isready -q; then echo "Postgres: accepting connections"; else echo "Postgres: NOT reachable. Start it before running the GP app."; fi
echo "Setup done. Run: npm run dev"
