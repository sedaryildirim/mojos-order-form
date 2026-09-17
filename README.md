# Mojo's Ordering

Mobile-first online ordering form built from `mojos_order_sheet-v2.xlsx`. Static site, no build step, no backend.

## Setup

1. Edit `config.js` — set the real email address for each branch (Nathon / Lamai) and optional CC.
2. Host the folder anywhere static (GitHub Pages, Netlify, Vercel, or an internal server) or just double-click `index.html` to test.

## Updating items / prices

Edit `data.js` — one array per category, one object per item (`id`, `name`, `unit`, `price`). No code changes needed elsewhere. Re-export the excel to this format whenever prices change.

## How it works

1. Staff picks branch (Nathon/Lamai).
2. Order form grouped by category (Dairy & Eggs, Meat & Poultry, Produce, etc.), each item has a +/- quantity stepper. Search box filters items.
3. "Review Order" shows a master list of everything selected.
4. "Send Order" opens the phone's mail app with the order pre-filled, addressed to that branch's configured email — staff taps send to confirm.

Draft quantities autosave to the browser (localStorage) so an accidental refresh doesn't lose progress.
