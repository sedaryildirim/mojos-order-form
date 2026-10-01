# Product

## Register

product

## Users

Kitchen/back-of-house staff at the Mojos and Kaif branches (Nathon, Lamai, Chaloklum, Thongsala, Kaif Chaloklum), placing supplier orders (Makro, Food Project, Drinks, Wine Pro, Phangan Green Vegetables, La Bottega, Fruit Shop) from a phone, often in a storage room or kitchen during a stocktake. Time-pressured, doing this as one task among many, not sitting at a desk.

## Product Purpose

The app opens on a menu of kitchen tools: Kaif GP Calculator and Mojos GP Calculator (both work in progress, shown greyed out and not tappable) and Ordering, which is the live tool. Ordering opens the branch picker (Koh Samui, then Koh Phangan, with Kaif Chaloklum as its own row), then the supplier picker.

Replace a manual Excel order sheet with a mobile-first ordering form: pick branch and supplier, work through categorized items entering current stock (to-order auto-calculates from par level), mark categories complete, review a master list with an estimated total, then send the order by email, copy/paste, or as a generated Excel file (shared straight to Mail/WhatsApp on supported phones, downloaded otherwise). Success = fewer ordering errors, faster than the spreadsheet, and a clear record of what was sent.

## Brand Personality

Efficient, no-nonsense, sturdy. A kitchen tool, not a consumer app: numbers should be unambiguous at a glance, taps should register instantly, and nothing on screen should exist just for decoration.

## Anti-references

Not a generic SaaS dashboard: no hero-metric cards, no corporate-cream B2B look. Expression (gradient, glow, display type, motion) is allowed on the entry and confirmation screens only; the working screens (order sheet, review) stay plain, fast and flat. Not a consumer food-delivery app either (Uber Eats/Grab) - this isn't customer-facing and shouldn't invite browsing or delight-seeking; it should invite finishing the task and closing the phone.

## Design Principles

- Numbers over decoration: par, stock, and to-order figures are the interface. Every visual choice should make them faster to read and edit with a thumb, not compete with them.
- One-handed, interruptible: staff carry stock while ordering. Large tap targets, forgiving inputs, autosaved progress, and no step that can't be resumed mid-task.
- State is the feedback: category completion, running totals, and warnings replace toasts and modals. The screen always shows where the order stands.
- Practice restraint where staff work: this is a tool used daily under time pressure. On the order and review screens aesthetic choices lose to clarity and speed every time they conflict. The first and last screens may carry more personality.

## Accessibility & Inclusion

Dark theme is the default on first load (a choice made with the toggle is remembered per device). Standard WCAG AA: sufficient contrast in both light and dark themes, pinch-zoom never disabled, tap targets at least 44px, legible under poor kitchen/storage-room lighting, no reliance on color alone to convey state (completion, warnings, has-qty rows already pair color with icons/text).

The Kaif GP Calculator (costing and gross profit) lives in `gp-calculator/` and is still a work in progress. It is a separate server app (Next.js + Postgres) and shows on the menu as a greyed-out card until it is ready and hosted.
