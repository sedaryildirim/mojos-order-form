# Design System: GP Calculator (Kaif)

**Status: work in progress.** Styled with the same system as the Mojos + Kaif ordering app (see `../DESIGN.md` for the full token list and rules). This file records how that system is applied here.

## Approach

- The markup is semantic HTML with **no class names**. All styling is in `src/app/globals.css` and hangs off elements, ARIA attributes and structure (`nav[aria-label="Main"]`, `[role="alert"]`, `th[aria-sort]`, `button[aria-pressed]`, `div:has(> table)` and so on).
- Where structure alone is not enough there are a few data attributes: `data-stat` (a labelled figure tile), `data-tone="good|low"` and `data-muted="true"` (GP status). Status is always also written in words ("On target", "Below target"), never colour alone.
- Do not nest `:has()` inside `:has()` (browsers drop the whole rule). Use `section > div:not(...)` style selectors instead.
- Fonts come from `next/font/google` in `src/app/layout.tsx` (Calistoga, Inter, JetBrains Mono) as CSS variables.

## Theme

Dark is the default; `[data-theme="light"]` remaps the same tokens. `layout.tsx` sets the theme before paint (key `mojos_theme`) and `ThemeToggle` sits in the top bar. Scrollbars and form controls follow the theme.

## Components

- **Top bar:** inverted slate, Calistoga brand, current page underlined in light blue, a "Menu" link back to the launcher and the theme toggle on the right.
- **Password gate:** a frosted-glass dialog (`backdrop-filter` blur on both the scrim and the panel) over the blurred, inert page. Appears on first load of a browser session; styled via `data-gate-*` attributes.
- **Page header:** a `div` holding an `h1` becomes a row with its actions beside it. A `div` of plain links becomes a row of outlined buttons.
- **Buttons:** 44px, outlined by default, `type="submit"` gets the blue gradient. `aria-pressed` buttons (Cards / Table) show a blue tint.
- **Filter bar:** a bordered card of labelled fields above a list.
- **Cards:** dish, ingredient, batch and supplier links render as cards with mono figure tiles. Supplier cards carry a gradient initial badge.
- **Tables:** rounded card, sticky mono header, tabular numbers, sortable headers are plain buttons.
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

- The supplier page filter bar and a few one-off link groups still use default spacing.
- Forms are single column; long forms (dish version, batch recipe) have not been given a two-column layout.
- Mobile layout is functional but not tuned; this tool is designed for a laptop or desktop.
- `PDF` export (`src/lib/pdf.tsx`) keeps its own react-pdf styles and is not part of the site CSS.
