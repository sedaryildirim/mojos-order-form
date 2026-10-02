# Design System: GP Calculator (Kaif)

**Status: work in progress.** Styled with the same system as the Mojo's + Kaif ordering app (see `../../DESIGN.md` for the full token list and rules). This file records how that system is applied here.

## Approach

- The markup is semantic HTML with **no class names**. All styling is in `src/app/globals.css` and hangs off elements, ARIA attributes and structure (`nav[aria-label="Main"]`, `[role="alert"]`, `th[aria-sort]`, `button[aria-pressed]`, `div:has(> table)` and so on).
- Where structure alone is not enough there are a few data attributes: `data-stat` (a labelled figure tile), `data-tone="good|low"` and `data-muted="true"` (GP status), `data-aligned` (a table that shares fixed column widths with its siblings), `data-sync` (the two sync result tables), `data-amount` (a price that sits in a fixed-width slot), `data-header-actions` (a header group mixing a button with link-buttons) and the `data-gp-chart` / `data-chart-*` family for the GP history chart. Status is always also written in words ("On target", "Below target"), never colour alone.
- **Everything must line up.** Cards in a row, table columns across separate tables and badges down a column must share edges. Check by rendering the page with the real stylesheet and looking at it, not by reading the CSS.
- Do not nest `:has()` inside `:has()` (browsers drop the whole rule). Use `section > div:not(...)` style selectors instead.
- Fonts come from `next/font/google` in `src/app/layout.tsx` (Calistoga, Inter, JetBrains Mono) as CSS variables.

## Theme

Dark is the default; `[data-theme="light"]` remaps the same tokens. `layout.tsx` sets the theme before paint (key `mojos_theme`) and `ThemeToggle` sits in the top bar. Scrollbars and form controls follow the theme.

## Components

- **Top bar:** inverted slate, Calistoga brand, current page underlined in light blue, a "All tools" link back to the launcher and the theme toggle on the right.
- **Password screen:** a frosted-glass dialog (title "Kaif GP Calculator", one field; `backdrop-filter` blur on both the scrim and the panel) over blurred stand-in shapes for the page (`/locked`, shown at the requested address while signed out). Styled via `data-gate-*` and `data-ghost` attributes. The top bar has a "Lock" button to end the session.
- **Error pages:** `error.tsx`, `not-found.tsx`, `loading.tsx` and `global-error.tsx` use the same plain element styling; each offers a way forward (try again, go to a list).
- **Page header:** a `div` holding an `h1` becomes a row with its actions beside it. A `div` of plain links becomes a row of outlined buttons. **A div must hold only links to get that styling**: one button inside it and its links lose the button look and spacing. Where a header needs a button as well (Ingredients: Sync from order sheet), the links stay alone in their own `div` and the button sits beside it inside a `[data-header-actions]` group, styled to match.
- **Buttons:** 44px, outlined by default, `type="submit"` gets the blue gradient. `aria-pressed` buttons (Cards / Table) show a blue tint.
- **Filter bar:** a bordered card of labelled fields above a list.
- **Cards (optional view, kept for the dish photos):** dish, ingredient and batch links render as cards with mono figure tiles. Each card is a flex column with its figure tiles pinned to the bottom, so the tiles line up across a row whatever the description length. Lists open as tables by default.
- **Per-category tables (supplier page):** each category is its own table, so they carry `data-aligned` and, above 720px, fixed column widths: Pack size, Price, Yield and Actions line up from one category to the next.
- **Unit price badges (ingredients table):** the price sits in `<data data-amount>` with a fixed `min-width`, so the "per kg" / "per l" badges start at one position. Never wrap such a number in a `<span>`: the global `td > span` rule styles every span as a red pill.
- **Order-sheet sync (Ingredients page):** the button sits in the header; its preview and result is a separate block under the header (never inside the header row) with a one-line summary and two `table[data-sync]` tables that share column widths.
- **GP history chart (dish and batch recipe pages):** a dark panel, capped to the width of the ingredient table (`52rem`), with a readout (latest value and the change since the update before), an SVG with a right-hand price axis, faint gridlines, a dashed 75% target line, an area under the line, a last-value tag, focusable points and a crosshair tooltip, then a "View data" table. The line and tag are green when the period improved and red when it got worse; `data-tone="up"` always means better for the business (GP up, or cost down). The scale never zooms in on a tiny range. On a dish page it sits last, under the ingredient list and house-made components, above the Photo and email tab.
- **Suppliers:** a table (name, ingredient count, contact), with a "Guessed prices" tag only on the placeholder supplier.
- **Dishes filter:** search, category, a single "Show" choice (All dishes, Below 75% GP, Guessed prices) and the Cards/Table toggle. The table has a "Guessed prices" count column instead of per-row chips.
- **Dish page actions:** "Edit recipe" (main), an "Export and share" menu (PDF, Excel, Share link) and a text link to compare with the last version.
- **Home:** on wide screens the "Below 75% GP" list on the left and the "Status" block (guessed prices, recently updated costs) beside it.
- **Dish page:** the title with its actions on one line; on wide screens the ingredient table on the left and a sticky summary panel on the right (GP largest).
- **Filter bars:** a plain row with a hairline under it, not a boxed card.
- **Forms:** related fields share a row (`data-row`): category and supplier, unit, pack size, price and yield, and so on.
- **Top bar on phones:** brand and buttons on one row, the links on a scrolling second row.
- **Tables:** rounded card; the mono header sticks under the top bar (`--nav-h`) while you scroll; 8px row padding; number columns are right-aligned automatically (`TableAlign` marks columns whose cells are all numbers); on small screens the table scrolls sideways inside its card. Dish, ingredient and batch lists open as a table by default (Cards is optional and remembered). GP cells read "69% (below target)" in red or "81% (on target)" in green: always words as well as colour.
- **Dish page:** four stat tiles (cost, menu price, GP, price for target GP). GP tile turns green (on target) or red (below target) with a text note.
- **Messages:** `role="alert"` is a red-outlined notice; `role="status"` is a blue pill; the one-time flash sits under the top bar.
- **Loading:** shimmer rows, with the label announced.
- **Print:** top bar, buttons and flash are hidden; page is black on white.

## Rules

- No decoration on working screens: no hero, glow or entrance animation. Motion is limited to hover and press feedback and the loading shimmer, and is switched off by `prefers-reduced-motion`.
- New colours go in the tokens at the top of `globals.css`, never inline.
- Keep every control at 44px or larger and every status paired with text.
- Numbers use JetBrains Mono with tabular figures so columns line up.

## Known gaps (work in progress)

- Forms are single column; long forms (dish version, batch recipe) have not been given a two-column layout.
- Mobile layout is functional but not tuned; this tool is designed for a laptop or desktop.
- `PDF` export (`src/lib/io/pdf.tsx`) keeps its own react-pdf styles and is not part of the site CSS. Its built-in font has no baht symbol, so amounts are written `THB 81.80` there (`formatTHBText`); screens keep the symbol.
