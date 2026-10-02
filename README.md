# Mojo's + Kaif

Two linked tools for the Mojos and Kaif kitchens:

| App | What it is | Where it lives | Runs as |
|---|---|---|---|
| **Web** (launcher + ordering form) | The menu you land on, and the supplier ordering form for each branch | `apps/web` | Static site (GitHub Pages) |
| **Kaif GP Calculator** | Dish costing, supplier prices and gross profit (work in progress) | `apps/gp-calculator` | Next.js server + Postgres |

The launcher menu has a card for each tool. The GP Calculator has a "All tools" link back. See [docs/architecture.md](docs/architecture.md) for how they connect.

## Repository map

```
apps/
  web/                    Static site: launcher menu + ordering form      (see apps/web/README.md)
  gp-calculator/          Next.js app: costing and GP                     (see apps/gp-calculator/README.md)
docs/
  architecture.md         How the two apps fit together and link to each other
  deployment.md           Hosting each app, and the settings that link them
  gp-calculator/          Original GP spec and implementation plans
scripts/
  setup.sh, stop.sh       One-time setup; stop the local servers
  dev.sh, dev/            Local dev server: site and GP Calculator on one port
data/                     Source price spreadsheets (kept locally, git-ignored)
.github/workflows/        Publishes apps/web to GitHub Pages
PRODUCT.md, DESIGN.md     Product intent and the design system shared by both apps
```

## Run locally

```bash
npm run setup     # once: installs the GP app's dependencies, creates its .env, checks Postgres
npm run dev       # everything on http://localhost:8080  (site at /, GP Calculator at /gp)
npm run stop      # stops it
```

`npm run dev:web` serves only the static site (no database needed). `npm test`, `npm run build` and `npm run backup` run the GP app's commands from the root. The GP Calculator needs Postgres and a `DATABASE_URL` in `apps/gp-calculator/.env`.

This folder is `mojos-kaif-master-folder`; the GitHub repository keeps its name, `mojos-order-form`.

## Weekly price update (order sheet -> GP Calculator)

The GP Calculator's ingredient list for Kaif comes from the order sheet's Kaif suppliers (Makro Kaif, Wine Pro, Phangan Green Vegetables, La Bottega, Fruit Shop).

1. Update prices or items in `apps/web/config/data.js`, commit, and push `master`. GitHub Pages publishes the new sheet within a minute or two.
2. In the GP Calculator open **Ingredients** and press **Sync from order sheet**. It shows a preview (new items, price changes, which dishes change cost) and nothing is saved until you press **Apply**.
3. Every dish and batch recipe that uses a changed price gets a new "Updated" version with cost and GP recalculated.

The same thing from a terminal, using the local file instead of the published one:

```bash
cd apps/gp-calculator
npm run sync:order-sheet -- --file ../web/config/data.js            # preview
npm run sync:order-sheet -- --file ../web/config/data.js --apply    # save
```

Good to know:
- Items are matched by their order-sheet id (stored as `sourceKey`), so a renamed item updates in place. An item that disappears from the sheet is deleted if nothing uses it, or archived if a recipe still does.
- An existing ingredient keeps its own pack size; only its price is updated, scaled to that pack. If the unit differs (for example grams in the GP, "each" on the sheet) it is left alone and listed.
- A new item whose pack size is not in its name (for example "Smoked Bacon") is added as 1 EACH and flagged. Add its real size to `apps/gp-calculator/src/data/order-sheet-packs.json`, keyed by its id such as `"labottega:236095": { "purchaseUnit": "G", "packQuantity": 1000 }`.
- After pulling a new version of the code, run `npm run setup` and restart `npm run dev`: a running server keeps the old database client until it restarts.

## Common jobs

| I want to... | Edit |
|---|---|
| Change a branch email or which suppliers a branch sees | `apps/web/config/config.js` |
| Change items, prices or par levels on the order sheets | `apps/web/config/data.js` |
| Change where the two apps link to each other | see [docs/architecture.md](docs/architecture.md#how-they-link) |
| Change colours, fonts or spacing | `apps/web/css/styles.css` and `apps/gp-calculator/src/app/globals.css` (tokens at the top) |
| Change the GP password | `GP_PASSWORD` (and `GP_SESSION_SECRET`) in `apps/gp-calculator/.env` |

## Conventions

- **Design:** both apps follow [DESIGN.md](DESIGN.md); each app's own `DESIGN.md` says how it applies that system.
- **Config before code:** anything the owner edits lives in a `config/` folder or an `.env` file, not in the app logic.
- **One folder per concern:** web code is split into `ordering/` (form logic) and `shell/` (menu, effects); GP code is grouped by feature (`components/dishes`, `lib/costing`, ...).
