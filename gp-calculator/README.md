# Kaif GP Calculator (work in progress)

Next.js 14 + Prisma + Postgres app for costing dishes and tracking gross profit. It lives in the Mojos + Kaif repo and is linked from the launcher menu as a greyed-out card until it is ready.

This is a server app (database, API routes, PDF and email). It cannot run on GitHub Pages; the static ordering site in the repo root is separate.

## Run locally

```bash
cp .env.example .env        # set DATABASE_URL (and optional BLOB / Resend keys)
npm install
npx prisma migrate deploy   # or: npx prisma db push
npm run dev                 # http://localhost:3000
```

## Password and home link

- The app asks for a password on first load of a browser session. It is temporary (`src/lib/gate.ts`, currently `555666`) and only checked in the browser, so it is not real security.
- The top bar and the password dialog link back to the launcher menu. Set `NEXT_PUBLIC_HOME_URL` in `.env` to point at it (defaults to the GitHub Pages site).

## Tests

Tests wipe tables, so they refuse to run unless `DATABASE_URL` contains `_test`:

```bash
cp .env.test.example .env.test
npm test
```

## Docs

- `PRODUCT.md`, `DESIGN.md`: product intent and how the shared design system is applied.
- `docs/superpowers/`: original spec and plans.
