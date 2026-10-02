# Kaif GP Calculator (work in progress)

Next.js 14 + Prisma + Postgres app for costing dishes and tracking gross profit. It lives in the Mojo's + Kaif repo (`apps/gp-calculator`) and is linked from the launcher menu (Beta card).

This is a server app (database, API routes, PDF and email). It cannot run on GitHub Pages; the static launcher and ordering site (`apps/web`) is separate.

## Source layout

```
src/
  app/                  Next.js routes: pages and api/ (colocated route tests)
  components/
    layout/               Top bar, theme toggle, flash message, password gate, page title, skeletons
    ui/                   Small shared controls (confirm button, view toggle, field error, photo upload...)
    dishes/               Dish version form, spec sheet, version compare
    batch/                Batch recipe form and scaler
    ingredients/          Ingredient form, picker, price history
    suppliers/            Supplier form and ingredient list
  lib/
    costing/              Costing maths: units, prices, batches, recalculation, estimates, switch/preview
    reports/              Derived views: dashboard summary, order list, version diff
    io/                   Import, export (xlsx, pdf), email, templates (fixtures/ for tests)
    client/               Browser-side helpers: actor, flash, api (safeFetch), site links, view mode
    auth/                 Sign-in: config, signed session, access rules, rate limit
    db/                   Prisma client and validation schemas
prisma/                 Schema and migrations
scripts/                Maintenance scripts (backup)
```

Tests sit next to the code they cover (`*.test.ts(x)`). Import across folders with the `@/` alias.

## Run locally

```bash
cp .env.example .env        # set DATABASE_URL (and optional BLOB / Resend keys)
npm install
npx prisma migrate deploy   # or: npx prisma db push
npm run dev                 # http://localhost:3000 on its own; from the repo root, `npm run dev` serves it at http://localhost:8080/gp
```

## Password and home link

- Every page and API route needs sign-in (`src/middleware.ts`). The password is checked on the server (`/api/auth/login`), which sets a signed session cookie (12 hours). Set `GP_PASSWORD` and `GP_SESSION_SECRET` in `.env`; in development they default to a temporary password, `555666`; in production they are required. After 8 wrong guesses in 5 minutes the address must wait. The `/share/<token>` links stay public.
- Edits to ingredients and suppliers are refused with a message if someone else saved first (`expectedUpdatedAt`).
- The top bar and the password dialog link back to the launcher menu. Set `NEXT_PUBLIC_HOME_URL` in `.env` to point at it (defaults to the GitHub Pages site).

## Tests

Tests wipe tables, so they refuse to run unless `DATABASE_URL` contains `_test`:

```bash
cp .env.test.example .env.test
npm test
```

## Docs

- `PRODUCT.md`, `DESIGN.md`: product intent and how the shared design system is applied.
- `../../docs/gp-calculator/`: original spec and plans.
