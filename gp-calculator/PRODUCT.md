# Product

**Status: work in progress.** This is the Kaif GP Calculator. It lives inside the Mojos + Kaif repo (`gp-calculator/`) and appears on the launcher menu as a greyed-out "Work in progress" card until it is ready and hosted.

## Register

product

## Users

The owner and managers of KAIF, a food and beverage business on Koh Phangan. They work at a laptop or desktop in a bright room, entering supplier prices, building recipes, and checking cost and gross profit per dish. Sessions involve a lot of scanning long lists (400+ ingredients, 35+ dishes) and comparing numbers in Thai baht.

## Product Purpose

Cost every dish accurately, track GP as supplier prices change, and keep suppliers and ingredients tidy. Success: the owner can open any screen and read prices, costs, and GP at a glance without squinting, and can spot which dishes changed after a price update.

## Brand Personality

Clean, calm, trustworthy. Quiet like Notion or Linear: the numbers are the star, chrome stays out of the way. It shares the Mojos + Kaif visual system (slate and electric blue, Calistoga headings, Inter for UI, JetBrains Mono for every figure). Because every screen here is a working screen, none of the entry-screen expression (hero, glow, motion) is used.

## Anti-references

Low-contrast grey-on-grey text, hard-coded colours that ignore the active theme, tiny type, decorative gradients (the blue gradient is allowed only on primary buttons and the supplier badge), dashboards full of identical hero metrics, neon or crypto styling.

## Design Principles

The site is styled with the shared Mojos + Kaif design system (see DESIGN.md). Dark is the default theme, matching the ordering app.

1. Legibility first: every piece of text meets WCAG AA contrast, body text is comfortably sized, numbers are tabular and easy to compare.
2. The task disappears the interface: familiar patterns, consistent buttons and form controls, no decoration that does not carry state.
3. Status is visible: current page, "Updated" recipes, low GP, placeholder-priced items, archived items are all clearly signalled and never rely on colour alone.
4. Dense but calm: show a lot of information per screen with generous spacing between groups, not inside them.

## Accessibility & Inclusion

WCAG AA minimum: 4.5:1 for body text, 3:1 for UI boundaries and focus rings. Visible keyboard focus. Do not rely on colour alone to convey GP health or updated status. Both themes (dark default, light) are fully token-driven, so no panel can stay light or dark by accident.

## Access

The tool opens behind a password prompt (temporary password in `src/lib/gate.ts`; replace with a real login before hosting). There is no per-person name: changes are recorded under the fixed name "Kaif". The waste log has been removed from the interface (its database table is left in place).
