# Architecture

```
            browser
               |
   +-----------+------------+
   |                        |
 apps/web (static)     apps/gp-calculator (Next.js)
 launcher + ordering   dishes, ingredients, suppliers, GP
   |   localStorage          |   Postgres (Prisma), Vercel Blob, Resend
   |                         |
   +---- "Kaif GP card" --->-+
   +<--- "All tools" link --------+
```

## The two apps

**web (`apps/web`)** is plain HTML, CSS and JavaScript with no build step. `index.html` holds every screen; `js/ordering/app.js` runs the ordering form (drafts in localStorage, totals, Excel/PDF/email/copy); `js/shell/` holds the menu and visual enhancements; `config/` holds everything the owner edits.

**gp-calculator (`apps/gp-calculator`)** is a Next.js 14 app with Prisma and Postgres. Pages are in `src/app`, UI in `src/components/<feature>`, logic in `src/lib/<domain>`. It has its own tests (Vitest) and a password gate in front of every page.

## How they link

| Direction | Mechanism | Setting |
|---|---|---|
| web -> GP | The "Kaif GP Calculator" card becomes a link when a URL is set | `tools.kaifGp.url` in `apps/web/config/config.js` (empty string greys the card out) |
| GP -> web | "All tools" button in the top bar and on the password dialog | `NEXT_PUBLIC_HOME_URL` in `apps/gp-calculator/.env` (falls back to the published Pages site) |

The apps share nothing else: no shared code, no shared database, no shared login. They share a **design system** (`DESIGN.md`) and a **theme preference name** (`mojos_theme`), which only helps when both are served from the same origin.

## Why two apps in one repo

They are used together and look the same, so keeping them side by side keeps the design, docs and links in step. They deploy separately because one is static files and the other needs a server and a database.
