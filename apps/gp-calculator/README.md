# Kaif GP Calculator (work in progress)

Next.js 14 + Prisma + Postgres app for costing dishes and batch recipes and tracking gross profit. It lives in the Mojo's + Kaif repo (`apps/gp-calculator`) and is linked from the launcher menu (Beta card). Its ingredient list comes from the Kaif order sheet: see "Order-sheet sync" below.

This is a server app (database, API routes, PDF and email). It cannot run on GitHub Pages; the static launcher and ordering site (`apps/web`) is separate.

## Source layout

```
src/
  app/                  Next.js routes: pages and api/ (colocated route tests)
    styles/             The CSS, nine numbered files imported in order by layout.tsx (the cascade depends on the order)
  components/
    layout/               Top bar, theme toggle, flash message, password gate, page title, skeletons
    ui/                   Small shared controls (confirm button, view toggle, field error, photo upload...)
    dishes/               Dish version form, spec sheet, version compare
    batch/                Batch recipe form and scaler
    ingredients/          Ingredient form, picker, price history, "Sync from order sheet" button and result
    suppliers/            Supplier form and ingredient list
    charts/               GpHistoryChart: the GP history chart on dish and batch recipe pages
  lib/
    costing/              Costing maths: units, prices, batches, recalculation, estimates, switch/preview,
                          gp-history (points for the chart), gp-chart (its scales and line paths) and cheaper-elsewhere
    sync/                 Order-sheet sync: pack-size reader, sheet loader and row builder, the sync itself
    reports/              Derived views: dashboard summary, order list, version diff
    io/                   Import, export (xlsx, pdf), email, templates (fixtures/ for tests)
    client/               Browser-side helpers: actor, flash, api (safeFetch), site links, view mode
    auth/                 Sign-in: config, signed session, access rules, rate limit
    db/                   Prisma client and validation schemas
  data/                   order-sheet-packs.json (pack-size exceptions)
prisma/                 Schema and migrations
scripts/                Command-line tools (see "Commands")
```

Tests sit next to the code they cover (`*.test.ts(x)`). Import across folders with the `@/` alias.

## Order-sheet sync

The Kaif ingredient list is not typed in by hand: **Ingredients -> Sync from order sheet** (or `npm run sync:order-sheet`) reads the order form's `config/data.js` and creates or updates ingredients, scaling each price into the ingredient's own pack, and recosting every batch recipe and dish that uses a changed price (new "Updated" versions, cost and GP recalculated). It always previews first. If a dish or batch uses a changed price but a recipe line no longer fits its ingredient's unit, it cannot be recosted: the report lists it under "Not recalculated" and it keeps its old cost until you fix the line. Each synced ingredient carries a `sourceKey` (`<sheet supplier>:<item id>`) so renames update in place. See the root README's "Weekly price update" for the routine and [../../docs/architecture.md](../../docs/architecture.md#how-the-order-sheet-feeds-the-gp-calculator) for how it works.

- **Flagged estimates:** items the order sheet does not list (house-made sauces, baking basics) are ingredients under the supplier "Placeholder / Estimated". Dishes using them show "guessed prices" until you set a real supplier and price.
- **Batch recipes** publish themselves as ingredients (supplier "House-Made") priced at their cost, so dishes can use them. They are never synced or deleted by the sync.
- **Placeholder prices:** some placeholders are `0` (the real price is not known yet, for example Sourdough Bread, Brioche Bun, Water, Chickpeas), others carry an estimate from the old data. Both show "Price is a guess" on the dishes and batches that use them, and a dish or batch flagged this way has an approximate cost. See `../../docs/food-bible/README.md` for the list.

## Dishes built from batch recipes (desserts and sweets)

A batch recipe publishes itself as an ingredient (supplier "House-Made"), so a dish can use it as a single line. The cakes, sweets and desserts are dishes with one line: **one portion of the batch** (the batch's `portionSize`, in grams) and the live menu price. Their cost therefore equals the batch's cost per portion, and it follows the batch automatically. A dish needs a recipe line to hold a menu price (the price lives on the dish version), so a card that is still waiting for a portion size has no price yet.

When you create a batch card for something an older import already published as an ingredient (same name, supplier "House-Made", no recipe), link the card's `outputIngredientId` to that ingredient before you save its lines. Otherwise the first save creates a second ingredient with the same name.

## Badges

`Dish.badge` and `BatchRecipe.badge` are optional short texts (migrations `20261003210000_add_dish_badge`, `20261003220000_add_batch_badge`). Current values: **Recipe updated** (green), **Unchanged recipe** (blue), **New dish** (amber), and the red "needs attention" ones such as **Chicken weight missing**, **Hummus weight missing** and **Portion size missing**. The colours are matched by text in `src/app/styles/06-cards-stats.css`, so a new text needs a rule there to get its own colour. There is no screen to edit a badge yet: set it in the database, for example `UPDATE "Dish" SET badge = 'New dish' WHERE name = '...';`.

## Batch recipe screen

Summary strip (cost, cost per unit, portions, cost per portion, live), GP history chart, basics, recipe lines, "+ Add ingredient" (opens the picker), notes, a Save bar pinned to the bottom of the screen, then "Scale this batch" and Delete. See `DESIGN.md` for the layout rules.

## GP history chart

Each dish page (below the ingredient list) and batch recipe page (at the top, under the summary strip) shows the **last 6 updates** as a terminal-style chart: a price axis on the right, a dashed 75% target line, a tag on the latest value and a crosshair tooltip. A dish's points are its versions (each carries its own cost and menu price). A batch has no versions, so its points are the cost history of the ingredient it publishes, per portion. Without a menu price the chart shows cost instead of GP. The line only appears once there is more than one update. The chart is an inline SVG with a "View data" table; there is no chart library.

## Commands

All commands that write are dry runs unless you add `--apply`. They need `DATABASE_URL` (load `.env.local`).

```bash
npm run sync:order-sheet [-- --apply] [-- --file ../web/config/data.js]
npm run backup                                          # JSON backup of every table into backups/
```

**Backups of the real data.** Dishes, batch recipes, prices and badges live only in the local Postgres database, never in git. Take a restorable copy with `pg_dump "$DATABASE_URL" > backups/<name>-$(date +%Y%m%dT%H%M%S).sql` before anything that writes in bulk, and keep a copy off this machine. `backups/` is git-ignored. Restore into an empty database with `psql <url> < file.sql`. The dumps from 2026-10-02/03 are named `pre-*` (before a wipe, import or reset) and `post-menu-rebuild-*` (the rebuilt menu: 52 dishes, 30 batch recipes, 344 ingredients).

## Run locally

```bash
cp .env.example .env        # set DATABASE_URL (and optional BLOB / Resend / ORDER_SHEET_URL keys)
npm install
npx prisma migrate deploy   # or: npx prisma db push
npm run dev                 # http://localhost:3000 on its own; from the repo root, `npm run dev` serves it at http://localhost:8080/gp
```

## Password and home link

- Every page and API route needs sign-in (`src/middleware.ts`). The password is checked on the server (`/api/auth/login`), which sets a signed session cookie (12 hours). Set `GP_PASSWORD` and `GP_SESSION_SECRET` in `.env`; in development they default to a temporary password, `555666`; in production they are required. After 8 wrong guesses in 5 minutes the address must wait. The `/share/<token>` links stay public.
- Edits to ingredients and suppliers are refused with a message if someone else saved first (`expectedUpdatedAt`).
- The top bar and the password dialog link back to the launcher menu. The "Lock" button ends the session and returns to the launcher. Set `NEXT_PUBLIC_HOME_URL` in `.env` to point at it (defaults to the GitHub Pages site).

## Tests

Tests wipe tables, so they refuse to run unless `DATABASE_URL` contains `_test`:

```bash
cp .env.test.example .env.test   # `npm run setup` at the repo root does this for you
npm test
```

The Food Bible parser also has tests against the real recipe file, which only run on a machine that has it (the file is not in the public repository); everywhere else they are skipped and an invented sample is used.

## Phones and accessibility

Checked at 390px and 1280px (Chrome) with axe (WCAG A and AA: no violations on any page) and a read-only click-through. On touch screens every tap target is 44px, the top bar tabs wrap, sideways-scrolling tables stay inside their card and are keyboard reachable, and every page has a tab title. Not covered: Safari, Firefox, real phones, screen readers.

## Docs

- `PRODUCT.md`, `DESIGN.md`: product intent and how the shared design system is applied.
- `../../docs/archive/`: original spec and plans, and the specs and plans for the order-sheet sync and the master folder (historical).
- `../../docs/food-bible/`: notes on the one-time recipe import.
