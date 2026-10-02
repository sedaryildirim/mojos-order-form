# Architecture

```
            browser
               |
   +-----------+------------+
   |                        |
 apps/web (static)     apps/gp-calculator (Next.js)
 launcher + ordering   dishes, batches, ingredients, suppliers, GP
   |   localStorage          |   Postgres (Prisma), Vercel Blob, Resend
   |                         |
   +---- "Kaif GP card" --->-+
   +<--- "All tools" link ---+
   |                         |
   +- config/data.js ---(read-only sync)--->  ingredients and prices
```

## The two apps

**web (`apps/web`)** is plain HTML, CSS and JavaScript with no build step. `index.html` holds every screen; `js/ordering/` (six numbered scripts) runs the ordering form (drafts in localStorage, totals, Excel/PDF/email/copy); `js/shell/` holds the menu and visual enhancements; `config/` holds everything the owner edits.

**gp-calculator (`apps/gp-calculator`)** is a Next.js 14 app with Prisma and Postgres. Pages are in `src/app`, UI in `src/components/<feature>`, logic in `src/lib/<domain>` (`costing`, `sync`, `import`, `io`, `reports`). It has its own tests (Vitest) and a password gate in front of every page.

## How they link

| Direction | Mechanism | Setting |
|---|---|---|
| web -> GP | The "Kaif GP Calculator" card becomes a link when a URL is set | `tools.kaifGp.url` in `apps/web/config/config.js` (empty string greys the card out) |
| GP -> web | "All tools" button in the top bar and on the password dialog | `NEXT_PUBLIC_HOME_URL` in `apps/gp-calculator/.env` (falls back to the published Pages site) |

The apps share no code, no database and no login. They share a **design system** (`DESIGN.md`) and a **theme preference name** (`mojos_theme`), which only helps when both are served from the same origin.

## How the order sheet feeds the GP Calculator

There is **one data flow between the apps, and it is one-way and read-only**: the GP Calculator reads the order sheet's `config/data.js`; the order form never reads the GP database.

- **What is read:** the Kaif suppliers only (`makro-kaif`, `winepro`, `phangangreenveg`, `labottega`, `fruitshop`), mapped to the GP's suppliers in `src/lib/sync/order-sheet-rows.ts`.
- **How it is read:** from the published site (`https://<user>.github.io/mojos-order-form/config/data.js`, or `ORDER_SHEET_URL`), or from a local file for the command line. The file is `const DATA = {...};` and is parsed as JSON. It is never executed.
- **How items are matched:** each GP ingredient can carry a `sourceKey` such as `makro-kaif:135318` (`<sheet supplier>:<item id>`). A renamed item updates in place; a changed id looks like a new item.
- **What a sync does:** it creates new ingredients, scales changed prices into each ingredient's own pack, records price history, recosts batch recipes, and gives every dish that uses a changed price a new "Updated" version. It previews first and only writes on Apply. A wrong or empty sheet is refused, so a bad download can never look like "everything was removed".
- **Where it runs:** the **Sync from order sheet** button on the Ingredients page (`POST /api/sync/order-sheet`, which only ever downloads the configured sheet, never an address from the request) and the `npm run sync:order-sheet` command. Both call the same code in `src/lib/sync/`.

Dishes and batch recipes live only in the GP database. Their ingredients are either synced Kaif items, **batch outputs** (a batch recipe publishes itself as a House-Made ingredient, so dishes can use it), or **flagged estimates** for items the order sheet does not list.

## Why two apps in one repo

They are used together and look the same, so keeping them side by side keeps the design, docs and links in step. They deploy separately because one is static files and the other needs a server and a database.

## Local development

`npm run dev` (repo root) starts one front door on http://localhost:8080 (`scripts/dev/dev-server.mjs`). It serves `apps/web` as static files and forwards the GP app's own paths (`/_next`, `/api`, `/dishes`, `/ingredients`, `/suppliers`, `/batch-recipes`, `/orders`, `/locked`, `/share`, and `/gp` as its home) to a Next.js dev server it starts on port 3410. Locally it also rewrites the launcher's GP link to `/gp` and replaces the offline service worker with one that removes itself, so cached pages never hide the GP app. None of this affects production hosting.
