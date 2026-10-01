# web: launcher and ordering form

Static site (no build step). Published to GitHub Pages from this folder.

```
index.html            All screens: launcher, branch, supplier, order, review, confirm
css/styles.css        All styles (design tokens at the top)
js/
  ordering/app.js     Ordering form logic (drafts, totals, Excel/email/copy)
  shell/              Site-wide enhancements that never touch ordering logic
    launcher.js         Launcher cards, back to all tools, theme toggle on the launcher (the only theme toggle)
    hero-fx.js          Pointer-reactive dot field on hero panels
    a11y.js             Moves focus to the new screen's heading
config/               The files you edit to run the business (no code needed)
  config.js           Branches, emails, suppliers per branch, launcher tool links
  data.js             Every supplier's categories, items, prices and par levels
```

Script order in `index.html` matters: config, data, ordering app, then the shell scripts.

## Everyday edits

1. **Branch emails / who sees which supplier:** `config/config.js`.
2. **Items, prices, pars:** `config/data.js` (one array per category, one object per item: `id`, `name`, `unit`, `par`, `price`).
3. **Kaif GP card link:** `tools.kaifGp.url` in `config/config.js` (`""` greys the card out).
4. **Look and feel:** tokens at the top of `css/styles.css`; see `../../DESIGN.md`.

## Resilience

- **Drafts are safe.** Saved under stable item ids, so editing `config/data.js` never moves a saved quantity onto a different item. Saving only touches the current supplier's slice, so two tabs can't overwrite each other, and a full or blocked store shows a notice instead of breaking the form. After an order is sent, a copy is kept: the confirm screen has "Didn't send it? Restore my order".
- **Works offline.** The Excel library and fonts are bundled (`js/vendor/`, `fonts/`), and `sw.js` caches the site so it opens with no signal (needs https or localhost; not `file://`). After you edit `config/` the change appears on the second reload; bump `VERSION` in `sw.js` to force it at once.
- **Long emails.** Many mail apps cut a `mailto:` link off near 2,000 characters; long orders get a warning pointing to Excel or Copy.

## Run

Open `index.html` in a browser, or from the repo root run `./scripts/dev.sh`.

Order drafts and the theme choice are saved in the browser (localStorage). Dark is the default theme.
