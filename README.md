# Mojo's Ordering

Mobile-first online ordering form built from `mojos_order_sheet-v2.xlsx`. Static site, no build step, no backend.

## Setup

1. Edit `config.js` — set the real email address for each branch (Nathon / Lamai) and optional CC.
2. Host the folder anywhere static (GitHub Pages, Netlify, Vercel, or an internal server) or just double-click `index.html` to test.

## Updating items / prices / par levels

Edit `data.js` — one array per category, one object per item (`id`, `name`, `unit`, `price`, `par`). No code changes needed elsewhere. Set each item's `par` to its target stock level; that's what drives the auto-calculated order quantity. Re-export the excel to this format whenever prices or pars change.

## How it works

1. Staff picks branch (Nathon/Lamai).
2. Order form grouped by category (Dairy & Eggs, Meat & Poultry, Produce, etc.). Each item shows its Par level (read-only, from `data.js`), a Current Stock field, and a To Order field. Entering Current Stock auto-fills To Order as `max(par - stock, 0)`; To Order can still be typed over manually at any time. Search box filters items.
3. Each category has a "Mark Category Complete" button — completed categories turn green so staff can see progress at a glance.
4. Running estimated total cost (based on To Order × unit price) shows in the bottom bar next to "Review Order".
5. "Review Order" shows a master list of everything selected with line totals and the overall estimated total.
6. "Send Order" opens the phone's mail app with the order (including par/stock/to-order per item) pre-filled, addressed to that branch's configured email — staff taps send to confirm.

Dark mode UI throughout. Draft (stock counts, to-order quantities, completed categories) autosaves to the browser (localStorage) so an accidental refresh doesn't lose progress.
