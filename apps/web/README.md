# web: launcher and ordering form

Static site (no build step). Published to GitHub Pages from this folder.

```
index.html            All screens: launcher, branch, supplier, order, review, confirm
css/styles.css        All styles (design tokens at the top)
js/
  ordering/app.js     Ordering form logic (drafts, order history, totals, Excel/PDF/email/copy)
  shell/              Site-wide enhancements that never touch ordering logic
    launcher.js         Launcher cards, back to all tools, theme toggle on the launcher (the only theme toggle)
    hero-fx.js          Pointer-reactive dot field on hero panels
    a11y.js             Moves focus to the new screen's heading
config/               The files you edit to run the business (no code needed)
  config.js           Branches, emails, suppliers per branch, launcher tool links
  data.js             Every supplier's categories, items, prices and par levels (also read by the GP Calculator's sync)
```

Script order in `index.html` matters: config, data, ordering app, then the shell scripts.

## Everyday edits

1. **Branch emails / who sees which supplier:** `config/config.js` (including `minimumOrders` per store, e.g. Wine Pro is 6 bottles for Nathon and Lamai, 12 for Chaloklum and Kaif).
2. **Items, prices, pars:** `config/data.js` (one array per category, one object per item: `id`, `name`, `unit`, `par`, `price`).
   **The GP Calculator reads this file.** Its Kaif suppliers (`makro-kaif`, `winepro`, `phangangreenveg`, `labottega`, `fruitshop`) feed the GP's ingredient list when you press *Sync from order sheet* there (see the root README, "Weekly price update"). So:
   - After `const DATA = ` the file must stay **plain JSON** (double-quoted keys, no comments, no trailing commas, ending in `};`). The GP parses it without running it, and refuses a file it cannot read.
   - An item's `id` is its identity in the GP. Change a price or a name freely, but **do not change an `id`**: it would look like a brand-new item.
   - Put the pack size in an item's name (for example "5 kg", "1 l x 3", "30 pcs") so the GP can read it. Prices are per `unit`: `Kilogram` items are per kg, `EACH` items per pack as named.
   - Mojo's lists (`makro-samui`, `makro-phangan`, `foodproject`, `drinks`, `combo`) are not read by the GP.
   - After editing, commit and push `master` so GitHub Pages publishes the new sheet before you sync.
3. **Kaif GP card link:** `tools.kaifGp.url` in `config/config.js` (`""` greys the card out).
4. **Look and feel:** tokens at the top of `css/styles.css`; see `../../DESIGN.md`.

## Resilience

- **Drafts are safe.** Saved under stable item ids, so editing `config/data.js` never moves a saved quantity onto a different item. Saving only touches the current supplier's slice, so two tabs can't overwrite each other, and a full or blocked store shows a notice instead of breaking the form. After an order is sent, a copy is kept: the confirm screen has "Didn't send it? Restore my order".
- **Works offline.** The Excel and PDF libraries and fonts are bundled (`js/vendor/`, `fonts/`), and `sw.js` caches the site so it opens with no signal (needs https or localhost; not `file://`). The cache name includes a fingerprint of `config/config.js` and `config/data.js`, so editing items, prices, pars or emails refreshes phones on their own. Bump `CODE_VERSION` in `sw.js` only when you change the site's own code or styles.
- **Order history.** Each store and supplier keeps its last 10 sent orders on this device (`mojos_order_history_v1`), shown as "Past orders" on the order screen. Each entry snapshots its items, so it still reads correctly after the data changes; "Use these quantities" matches items back by id and skips any that no longer exist. Re-sending an identical order updates the entry instead of duplicating it.
- **Combo sections.** A category can carry a `combo` in `config/data.js` (Food Project beef: patty weight, `pattiesPerBurger`, `burgerLabel`). It counts patties and burgers from the weight that matches across the two cuts and flags any extra.
- **Long emails.** Many mail apps cut a `mailto:` link off near 2,000 characters; long orders get a warning pointing to Excel, PDF or Copy.

## Run

Open `index.html` in a browser, or from the repo root run `npm run dev:web` (site only) or `npm run dev` (site and GP Calculator).

Order drafts and the theme choice are saved in the browser (localStorage). Dark is the default theme.
