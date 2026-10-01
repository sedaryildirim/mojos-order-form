# Mojos + Kaif Suppliers Ordering System

Static site (GitHub Pages) with a launcher menu and the supplier ordering form, plus the Kaif GP Calculator as a separate server app.

## Folder structure

```
index.html            Page markup: launcher, branch, supplier, order, review, confirm screens
css/styles.css        All styles (design tokens at the top)
js/
  ordering/app.js     The ordering form logic (drafts, totals, Excel/email/copy)
  shell/              Site-wide enhancements that never touch ordering logic
    launcher.js         Menu cards, back to menu, theme toggle on the menu
    hero-fx.js          Pointer-reactive dot field on hero panels
    a11y.js             Moves focus to the new screen's heading
config/               The files you edit to run the business (no code needed)
  config.js           Branches, emails, which suppliers each branch sees, launcher tool links
  data.js             Every supplier's categories, items, prices and par levels
data/                 Source spreadsheets (not loaded by the site)
gp-calculator/        Kaif GP Calculator (Next.js + Postgres), work in progress; see its README
PRODUCT.md, DESIGN.md Product intent and design system
```

Script order in `index.html` matters: config, data, ordering app, then the shell scripts.

## Everyday edits

1. **Branch emails / who sees which supplier:** `config/config.js`.
2. **Items, prices, pars:** `config/data.js` (one array per category, one object per item: `id`, `name`, `unit`, `par`, `price`).
3. **Make the Kaif GP Calculator card selectable:** set `tools.kaifGp.url` in `config/config.js` (leave `""` to grey it out). It currently points at `http://localhost:3000`; replace it with the hosted address once the GP app is deployed.
4. **Colours, type, spacing:** tokens at the top of `css/styles.css`.

## Run locally

Open `index.html` in a browser (no build step). To use the GP card locally, start the GP app too (see `gp-calculator/README.md`).

## Data stays on the device

Order drafts are saved in the browser (localStorage) per branch and supplier. The theme choice is saved too; dark is the default.
