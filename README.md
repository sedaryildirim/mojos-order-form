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
