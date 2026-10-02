# Product

**Status: work in progress.** This is the Kaif GP Calculator. It lives inside the Mojo's + Kaif repo (`apps/gp-calculator/`) and is linked from the launcher as a Beta card (still being tested). It needs a server and database, so it is hosted separately from the static launcher.

## Register

product

## Users

The owner and managers of KAIF, a food and beverage business on Koh Phangan. They work at a laptop or desktop in a bright room, entering supplier prices, building recipes, and checking cost and gross profit per dish. Sessions involve a lot of scanning long lists (300+ ingredients, 35+ dishes, 17 batch recipes) and comparing numbers in Thai baht.

## Product Purpose

Cost every dish and batch recipe accurately, track GP as supplier prices change, and keep suppliers and ingredients tidy. The Kaif ingredient list follows the Kaif order sheet: updating the order sheet and pressing one button brings the new prices in and recalculates every affected dish. Success: the owner can open any screen and read prices, costs, and GP at a glance without squinting, can spot which dishes changed after a price update, and can see on a dish's page how its GP moved over the last few updates.

## Brand Personality

Clean, calm, trustworthy. Quiet like Notion or Linear: the numbers are the star, chrome stays out of the way. It shares the Mojo's + Kaif visual system (slate and electric blue, Calistoga headings, Inter for UI, JetBrains Mono for every figure). Because every screen here is a working screen, none of the entry-screen expression (hero, glow, motion) is used.

## Anti-references

Low-contrast grey-on-grey text, hard-coded colours that ignore the active theme, tiny type, decorative gradients (the blue gradient is allowed only on primary buttons), dashboards full of identical hero metrics, neon or crypto styling.

## Design Principles

The site is styled with the shared Mojo's + Kaif design system (see DESIGN.md). Dark is the default theme, matching the ordering app.

1. Legibility first: every piece of text meets WCAG AA contrast, body text is comfortably sized, numbers are tabular and easy to compare.
2. The task disappears the interface: familiar patterns, consistent buttons and form controls, no decoration that does not carry state.
3. Status is visible: current page, "Cost updated" recipes, low GP, guessed prices (flagged estimates for items the order sheet does not list) and archived items are all clearly signalled and never rely on colour alone.
4. Line things up: cards in a row, table columns across tables and badges down a column share edges, because the owner scans by eye.
5. Dense but calm: show a lot of information per screen with generous spacing between groups, not inside them. Lists open as tables with sticky headers and right-aligned numbers; related form fields share a row.
6. Never overwrite silently: a save made on a stale copy is refused with a plain message, and a failed save keeps what was typed.

## Accessibility & Inclusion

WCAG AA minimum: 4.5:1 for body text, 3:1 for UI boundaries and focus rings. Visible keyboard focus. Do not rely on colour alone to convey GP health or updated status. Both themes (dark default, light) are fully token-driven, so no panel can stay light or dark by accident.

## Access

The tool opens behind a password prompt. The password is checked on the server and protects every page and API route (`GP_PASSWORD` / `GP_SESSION_SECRET`; temporary dev default `555666`). There is no per-person name: changes are recorded under the fixed name "Kaif". The waste log has been removed (its empty database table was dropped).
