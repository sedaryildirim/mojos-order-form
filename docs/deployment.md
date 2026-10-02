# Deployment

## web -> GitHub Pages

`.github/workflows/pages.yml` publishes the `apps/web` folder on every push to `master` that touches it.

One-time setting: **Settings -> Pages -> Build and deployment -> Source: GitHub Actions.** (The old "Deploy from a branch" setting served the repo root, which no longer holds the site.)

The site URL stays `https://<user>.github.io/mojos-order-form/`.

## gp-calculator -> a Node host with Postgres

It needs a server, so GitHub Pages cannot host it. Vercel is the simplest fit (it already uses Vercel Blob for photos):

1. Create a Postgres database and set `DATABASE_URL`.
2. Run `npx prisma migrate deploy` (this includes the `sourceKey` column the order-sheet sync needs).
3. Set `GP_PASSWORD` and `GP_SESSION_SECRET` (required in production: without them nobody can sign in), plus `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `BLOB_READ_WRITE_TOKEN` (see `apps/gp-calculator/.env.example`).
4. Optional: set `ORDER_SHEET_URL` if the order sheet is published somewhere other than `https://sedaryildirim.github.io/mojos-order-form/config/data.js`. The **Sync from order sheet** button downloads from this address only.
5. Deploy with the project root set to `apps/gp-calculator`.
6. On a brand-new database, open **Ingredients** and press **Sync from order sheet** (preview, then Apply) to load the Kaif ingredient list. Recipes are not in the repository. To move them to a new database, restore a `pg_dump` of the current one (see `npm run backup` and the root README) rather than re-importing; the one-time Food Bible importer has been removed (see [food-bible/README.md](food-bible/README.md)).

After any release that changes the database schema, restart the server: a running Next.js server keeps the old Prisma client until it restarts.

## Weekly updates once both are hosted

The sync reads the **published** order sheet, so the order is: edit `apps/web/config/data.js`, push `master` (GitHub Pages republishes `apps/web`), then press **Sync from order sheet** in the hosted GP Calculator. Nothing runs automatically yet. A scheduled run (a cron calling `POST /api/sync/order-sheet` with `{"apply": true}`, behind the sign-in) is a possible later step.

## Linking the two once both are hosted

Change the two settings listed in [architecture.md](architecture.md#how-they-link), then redeploy the GP app.

## Before going live with the GP Calculator

- Sign-in is checked on the server and protects every page and API route (`src/middleware.ts`), with a signed 12-hour session cookie and a limit on wrong guesses. It is a single shared password, not per-person accounts. The wrong-guess limit is per server instance and resets on restart.
- Public share links (`/share/<token>`) are open by design; their tokens are random UUIDs. Links made before this change used shorter ids.
- The repository is public, so the GP source and the order sheet are visible. **Recipes, dish costs, menu prices and database backups must never be committed**: they are git-ignored local files (see the root README, "Keeping this public repository clean"). Move `apps/gp-calculator` to a private repository if the source itself matters.
- Back up before bulk changes: `pg_dump` for a restorable copy (check it loads into a scratch database), `npm run backup` for a JSON copy. Both go to `apps/gp-calculator/backups/`, which is git-ignored.
