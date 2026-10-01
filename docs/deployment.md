# Deployment

## web -> GitHub Pages

`.github/workflows/pages.yml` publishes the `apps/web` folder on every push to `master` that touches it.

One-time setting: **Settings -> Pages -> Build and deployment -> Source: GitHub Actions.** (The old "Deploy from a branch" setting served the repo root, which no longer holds the site.)

The site URL stays `https://<user>.github.io/mojos-order-form/`.

## gp-calculator -> a Node host with Postgres

It needs a server, so GitHub Pages cannot host it. Vercel is the simplest fit (it already uses Vercel Blob for photos):

1. Create a Postgres database and set `DATABASE_URL`.
2. Run `npx prisma migrate deploy`.
3. Set `GP_PASSWORD` and `GP_SESSION_SECRET` (required in production: without them nobody can sign in), plus `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `BLOB_READ_WRITE_TOKEN` (see `apps/gp-calculator/.env.example`).
4. Deploy with the project root set to `apps/gp-calculator`.

## Linking the two once both are hosted

Change the two settings listed in [architecture.md](architecture.md#how-they-link), then redeploy the GP app.

## Before going live with the GP Calculator

- Sign-in is checked on the server and protects every page and API route (`src/middleware.ts`), with a signed 12-hour session cookie and a limit on wrong guesses. It is a single shared password, not per-person accounts. The wrong-guess limit is per server instance and resets on restart.
- Public share links (`/share/<token>`) are open by design; their tokens are random UUIDs. Links made before this change used shorter ids.
- The repository is public, so the GP source is visible. Move `apps/gp-calculator` to a private repository if that matters.
