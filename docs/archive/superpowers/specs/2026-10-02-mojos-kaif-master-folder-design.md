# mojos-kaif-master-folder: design

## Goal
One self-contained working folder, `~/mojos-kaif-master-folder`, built from `~/mojos-order-form` (the up-to-date version, local and on GitHub). Easy to run, maintain and find things in. One command starts one local server on one port for testing.

## Decisions (from the owner)
- `mojos-order-form` is the source of truth. Missing pieces from `mojos-combined`, `mojos-kaif-platform` and `~/gp-calculator` are intentional; those folders are not touched and nothing is merged from them.
- Everything important is MOVED, not copied: the old `~/mojos-order-form` folder no longer exists afterwards.
- Local testing: one command, one port. Production hosting is unchanged (static site on GitHub Pages, GP app on its own host).
- Keep git history, both branches and the origin remote. Nothing is pushed.
- Keep the `apps/web` and `apps/gp-calculator` names (CI, links and docs depend on them).

## Target structure
```
mojos-kaif-master-folder/
  README.md            start here: setup, run, stop, deploy, "where do I edit X"
  package.json         root commands: setup, dev, dev:web, dev:gp, stop, test, build, backup
  apps/
    web/               static launcher + order form (unchanged inside)
    gp-calculator/     Next.js GP app, real node_modules (unchanged inside)
  docs/                architecture, deployment, GP specs/plans, this spec
  scripts/             setup.sh, dev.sh, stop.sh, dev-server.mjs (the one-port front door)
  data/                source price spreadsheets (git-ignored)
  .github/workflows/   Pages deploy (unchanged)
  .claude/             launch.json pointing at the new path
```

## One server, one port
`scripts/dev-server.mjs` (plain Node, no new dependencies) listens on 8080. It starts the GP Next.js dev server on an internal port (3000) and forwards the GP app's own paths there (`/_next`, `/api`, `/dishes`, `/ingredients`, `/suppliers`, `/batch-recipes`, `/orders`, `/locked`, `/share`, and `/gp` as its home). Everything else is served as static files from `apps/web`.
- No GP `basePath` change, so production builds are unaffected.
- The launcher's Kaif GP card points at `/gp` locally via a dev-only override, not by editing `config.js`.
- Known limit to verify: the GP app's own links to `/` would land on the launcher.
- Known limit to verify: the service worker `sw.js` must not cache GP pages.

## Move procedure (safe order)
1. Stop the running servers (8080, 3000, by port only).
2. Confirm git is clean on `master` (it is: 0 uncommitted files at last check).
3. `mv ~/mojos-order-form ~/mojos-kaif-master-folder` (one rename, so history, ignored files, `.env*`, `data/` and `.claude/` all move with it).
4. Replace the `apps/gp-calculator/node_modules` symlink (points at `~/gp-calculator`) with a real `npm install`.
5. Add the root files above and fix paths in README, docs and `launch.json`.

## Verification
Run `npm run dev` from the new folder, then check on the single port: launcher loads, ordering form loads, `/gp` loads and a database-backed page (dishes) loads, GP tests pass, `npm run stop` frees both ports. Report real results, including anything that fails.

## Out of scope
Merging code from the other folders, renaming `apps/`, changing production hosting, pushing to GitHub, touching the databases.
