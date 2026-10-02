# Mojo's + Kaif

Two linked tools for the Mojos and Kaif kitchens:

| App | What it is | Where it lives | Runs as |
|---|---|---|---|
| **Web** (launcher + ordering form) | The menu you land on, and the supplier ordering form for each branch | `apps/web` | Static site (GitHub Pages) |
| **Kaif GP Calculator** | Dish and batch-recipe costing, supplier prices and gross profit. Its ingredient list is fed from the Kaif order sheet | `apps/gp-calculator` | Next.js server + Postgres |

The launcher menu has a card for each tool. The GP Calculator has an "All tools" link back. See [docs/architecture.md](docs/architecture.md) for how they connect.

## What the GP Calculator does

- **Costs every dish and batch recipe** from ingredient prices. GP is `(menu price - cost) / menu price` (no VAT adjustment); the target is 75%.
- **Ingredients come from the Kaif order sheet** (Makro Kaif, Wine Pro, Phangan Green Vegetables, La Bottega, Fruit Shop), refreshed with one button. Items the order sheet does not list (house-made sauces, baking basics) are **flagged estimates** with a guessed price until you enter a real one.
- **Every price change creates a new "Updated" version** of each dish that uses it, so history is kept. A **GP history chart** at the bottom of a dish page, and on a batch recipe page, shows the last 6 updates.
- **Exports:** PDF (amounts written as `THB 81.80`, since the PDF font has no baht symbol), Excel, and a public share link.

## Repository map

```
apps/
  web/                    Static site: launcher menu + ordering form      (see apps/web/README.md)
  gp-calculator/          Next.js app: costing and GP                     (see apps/gp-calculator/README.md)
docs/
  architecture.md         How the two apps fit together and link to each other
  deployment.md           Hosting each app, and the settings that link them
  food-bible/             Notes on the one-time recipe import (the recipes themselves are not in git)
  archive/                Historical specs and plans (original GP build, master folder, order-sheet sync)
scripts/
  setup.sh, stop.sh       One-time setup; stop the local servers
  dev.sh, dev/            Local dev server: site and GP Calculator on one port
data/                     Source price spreadsheets (kept locally, git-ignored)
.github/workflows/        Publishes apps/web to GitHub Pages
PRODUCT.md, DESIGN.md     Product intent and the design system shared by both apps
```

## Run locally

```bash
npm run setup     # once: installs the GP app's dependencies, creates its .env and .env.test, checks Postgres
npm run dev       # everything on http://localhost:8080  (site at /, GP Calculator at /gp)
npm run stop      # stops it
```

`npm run dev:web` serves only the static site (no database needed). `npm test`, `npm run build` and `npm run backup` run the GP app's commands from the root. The GP Calculator needs Postgres and a `DATABASE_URL` in `apps/gp-calculator/.env`.

This folder is `mojos-kaif-master-folder`; the GitHub repository keeps its name, `mojos-order-form`.

## Weekly price update (order sheet -> GP Calculator)

1. Update prices or items in `apps/web/config/data.js`, commit, and push `master`. GitHub Pages publishes the new sheet within a minute or two. **Keep `data.js` machine-readable**: after `const DATA = ` it must stay plain JSON (double-quoted keys, no comments, no trailing commas), because the GP reads it without running it.
2. In the GP Calculator open **Ingredients** and press **Sync from order sheet**. It shows a preview (new items, price changes, which dishes change cost) and nothing is saved until you press **Apply**.
3. Every dish and batch recipe that uses a changed price gets a new "Updated" version with cost and GP recalculated.

The same thing from a terminal, using the local file instead of the published one:

```bash
cd apps/gp-calculator
npm run sync:order-sheet -- --file ../web/config/data.js            # preview
npm run sync:order-sheet -- --file ../web/config/data.js --apply    # save
```

Good to know:
- Items are matched by their order-sheet id (stored as `sourceKey`), so a renamed item updates in place. **Do not change an item's `id`** in `data.js`: it would look like a new item. An item that disappears from the sheet is deleted if nothing uses it, or archived if a recipe still does.
- An existing ingredient keeps its own pack size; only its price is updated, scaled to that pack. If the unit differs (for example grams in the GP, "each" on the sheet) it is left alone and listed. Grams and millilitres are treated as the same.
- A new item whose pack size is not in its name (for example "Smoked Bacon") is added as 1 EACH and flagged. Add its real size to `apps/gp-calculator/src/data/order-sheet-packs.json`, keyed by its id such as `"labottega:236095": { "purchaseUnit": "G", "packQuantity": 1000 }`.
- Only the Kaif suppliers are synced. Mojo's lists (Makro Samui and Phangan, Food Project, Drinks) stay on the order form only.
- After pulling a new version of the code, run `npm run setup` and restart `npm run dev`: a running server keeps the old database client until it restarts.

## GP Calculator commands

Run these in `apps/gp-calculator` (they need `DATABASE_URL`; load it from `.env.local`). Every command that writes is a **dry run unless you add `--apply`**.

| Command | What it does |
|---|---|
| `npm run sync:order-sheet [-- --apply] [-- --file <path>]` | Pull the Kaif order sheet into the ingredient list (see above) |
| `npm run backup` | JSON backup of every table into `backups/` (use `pg_dump` for a restorable copy) |

Take a `pg_dump` before anything that writes in bulk, and confirm it restores into a scratch database.

## Keeping this public repository clean

The GitHub repository is **public**. Never commit:

- **Recipes, dish costs, menu prices or cost reports.** The Food Bible text (`docs/food-bible/kaif-food-bible.txt`) and `docs/archive/superpowers/plans/*-sync-trial-report.md` are git-ignored local files; the tests use an invented sample.
- **Backups and database dumps** (`apps/gp-calculator/backups/`) or **`.env` files**: both are git-ignored.
- **Passwords or database logins.**

Before every push, read `git diff origin/master..HEAD`. Pushing `master` redeploys the live ordering form only when something under `apps/web` changed.

## Common jobs

| I want to... | Edit |
|---|---|
| Change a branch email or which suppliers a branch sees | `apps/web/config/config.js` |
| Change items, prices or par levels on the order sheets | `apps/web/config/data.js`, then sync |
| Give a new item a pack size the GP cannot read from its name | `apps/gp-calculator/src/data/order-sheet-packs.json` |
| Set the real price of a flagged estimate (Hollandaise, Hummus...) | **Ingredients** page in the GP Calculator |
| Change where the two apps link to each other | see [docs/architecture.md](docs/architecture.md#how-they-link) |
| Change colours, fonts or spacing | `apps/web/css/styles.css` and `apps/gp-calculator/src/app/styles/` (tokens at the top of `01-base.css`) |
| Change the GP password | `GP_PASSWORD` (and `GP_SESSION_SECRET`) in `apps/gp-calculator/.env` |

## Conventions

- **Design:** both apps follow [DESIGN.md](DESIGN.md); each app's own `DESIGN.md` says how it applies that system. In the GP Calculator everything must **line up**: cards in a row, table columns across tables, badges down a column.
- **Config before code:** anything the owner edits lives in a `config/` folder or an `.env` file, not in the app logic.
- **One folder per concern:** web code is split into `ordering/` (form logic) and `shell/` (menu, effects); GP code is grouped by feature (`components/dishes`, `lib/costing`, `lib/sync`, ...).
- **Dry run first:** anything that changes data in bulk previews before it applies.
