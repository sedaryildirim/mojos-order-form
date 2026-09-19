---
name: Mojo's Ordering
description: Mobile-first stock-order form for Mojo's back-of-house staff
colors:
  charred-terracotta: "#e0673f"
  charred-terracotta-pressed: "#c2532f"
  seasoned-cast-iron: "#14130f"
  ash-surface: "#25221b"
  ash-surface-raised: "#363226"
  ash-surface-lifted: "#494434"
  warm-parchment: "#f2ede4"
  faded-soot: "#b3a99a"
  hairline-ash: "#7a735c"
  verified-green: "#4caf68"
  verified-green-bg: "#1c2b1e"
  alert-red: "#d6564a"
  caution-amber-bg: "#3d2a14"
  caution-amber-text: "#f2c98d"
  caution-amber-border: "#6b4a1f"
colors-light:
  charred-terracotta: "#e0673f"
  charred-terracotta-pressed: "#c2532f"
  charred-terracotta-ink: "#a53f1d"
  worn-parchment-bg: "#ebe7e0"
  paper-surface: "#f9f8f6"
  paper-surface-raised: "#e2dfd9"
  paper-surface-lifted: "#d3cec5"
  ink-text: "#2f261e"
  faded-ink: "#625947"
  hairline-brown: "#8e8167"
  verified-green: "#24603a"
  verified-green-bg: "#ddeee3"
  alert-red: "#a53327"
  caution-amber-bg: "#f6e6cb"
  caution-amber-text: "#864913"
  caution-amber-border: "#9e662e"
typography:
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "14.5px"
    fontWeight: 400
    lineHeight: 1.3
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "10.5px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.03em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.2
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "19px"
    fontWeight: 600
    lineHeight: 1.2
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1.1
rounded:
  sm: "10px"
  md: "12px"
  lg: "14px"
  full: "50%"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.charred-terracotta}"
    textColor: "#241206"
    rounded: "{rounded.md}"
    padding: "13px 20px"
  button-primary-active:
    backgroundColor: "{colors.charred-terracotta-pressed}"
    textColor: "#241206"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.charred-terracotta}"
    rounded: "{rounded.md}"
    padding: "13px 20px"
  icon-button:
    backgroundColor: "{colors.ash-surface-raised}"
    textColor: "{colors.warm-parchment}"
    rounded: "{rounded.md}"
    width: "44px"
    height: "44px"
  category-card:
    backgroundColor: "{colors.ash-surface}"
    rounded: "{rounded.lg}"
  category-card-completed:
    backgroundColor: "{colors.verified-green-bg}"
  stepper-button:
    backgroundColor: "transparent"
    textColor: "{colors.charred-terracotta}"
    width: "44px"
    height: "44px"
---

# Design System: Mojo's Ordering

## 1. Overview

**Creative North Star: "The Stock Room Ledger"**

This is a working ledger kept on a shelf in the storage room, not a showroom piece. Someone checks it while holding a case of tinned tomatoes, taps a number, moves on. Every design decision serves that moment: legible at a glance, forgiving of a rushed thumb, and honest about what's been done and what hasn't. It rejects the vocabulary of consumer apps and SaaS dashboards alike, no onboarding flourish, no gradient CTA, no hero metric tile, because neither is what a ledger looks like.

The palette is warm and dim rather than cold and dark: a near-black brown-black background (not pure `#000`), one committed accent used for action and status, and everything else a tonal step of the same warm neutral. Nothing here is decorative. If a color, weight, or spacing choice doesn't help someone read a number faster or trust that a tap registered, it's cut.

**Key Characteristics:**
- One warm accent, used deliberately for action and current-state, never as background decoration
- Flat surfaces layered by tone, not by shadow
- Numbers and labels carry the hierarchy; nothing competes with them for attention
- Every interactive control sized for a thumb, not a cursor

## 2. Colors

The app now ships two themes, Dark (the original, default) and Light, switched by a toggle on the branch-selection screen and remembered per device. Both are the same warm-neutral material and the same one-accent system; only the direction of the tonal ramp flips. The scene that justifies offering both: dark suits the dim storage room this app was designed for, but a bright prep line at midday, or a phone screen catching direct light near a loading dock, makes a dark UI mostly glare. Staff pick whichever reads better where they're standing.

The palette is a warm-neutral scale stepped by surface depth, plus one committed accent that still carries action and status. Every neutral is warmed toward the same brown-black hue rather than true gray (or true cream, in Light), so the whole system reads as one material rather than a UI-kit default.

The neutral ramp was widened in a legibility pass: the original three surface tones sat only ~3% apart in lightness and the hairline border was barely visible (1.3:1 against its card), so card boundaries, item dividers, and field outlines relied on almost nothing under real kitchen lighting. Each step is now ~5.5% apart, and the border was pushed to a genuinely visible 3.1-3.4:1 against the surfaces it outlines. The hue and the anchor background didn't move: this is the same material, just legible at a glance instead of on close inspection.

### Primary
- **Charred Terracotta** (`#e0673f`): the one accent, used only for button fills. Identical value in both themes: paired against the fixed dark button text (`#241206`), the contrast math doesn't change with the theme, so the primary button looks the same everywhere. Never used as a background outside of buttons and their armed/confirming states.
- **Charred Terracotta Pressed** (`#c2532f`): the active/pressed state for primary buttons. Darker, not lighter, so a press reads as "sinking in," not "lighting up." Also unchanged between themes.
- **Charred Terracotta Ink** (dark theme: same as Charred Terracotta, `#e0673f`; light theme: `#a53f1d`): the accent's value wherever it's used as literal text, an icon glyph, or a border directly on a surface, not as a button fill. The vivid `#e0673f` reads at 2.6-3.2:1 on the light theme's pale surfaces, well under AA; a plain hue swap of the whole accent would have either broken light-mode legibility or thrown off the button color in dark mode. Splitting "accent as fill" from "accent as ink" solved both without compromise. Drives: the focus ring, stepper +/- icons, the running total, the combo-box's dashed border and patty count, ghost/secondary button text and border, and review-line quantities.

### Neutral
- **Seasoned Cast Iron** (`#14130f`): the base background. A warm near-black, not `#000`, evoking a worn tool rather than a screen. Unchanged; every other neutral is a step up from this anchor.
- **Ash Surface** (`#25221b`): the first layer up from the background: category cards, the topbar, the bottom bar, item-row dividers.
- **Ash Surface Raised** (`#363226`): the second layer: inputs, steppers, icon buttons, the Par field. The surface a finger actually touches sits one step higher than the surface it rests on.
- **Ash Surface Lifted** (`#494434`): the third layer, reserved for momentary `:active`/pressed states on category headers and icon buttons. Never a resting-state background; it's the tone something jumps to for the instant it's held down.
- **Warm Parchment** (`#f2ede4`): primary text. An off-white, never pure `#fff`, so it never glares against the warm dark surfaces around it.
- **Faded Soot** (`#b3a99a`): secondary text: labels, units, category counts, timestamps. Present but never competing with a number.
- **Hairline Ash** (`#7a735c`): all hairline borders and dividers. Lightened from `#35312a` so card edges, item-row separators, and field outlines are actually visible (3.1-3.4:1 against the surfaces they sit on) rather than relying on the eye to fill in a boundary that wasn't really there.

### Status
- **Verified Green** (`#4caf68`) / **Verified Green Background** (`#1c2b1e`): a category that's been checked off. The only place green appears; it means "confirmed," nowhere else.
- **Alert Red** (`#d6564a`): destructive actions only (Clear All) and their armed/confirming state. Never used for ordinary errors or emphasis.
- **Caution Amber** (background `#3d2a14`, text `#f2c98d`, border `#6b4a1f`): incomplete-work warnings, the review-screen send-gate, and MOQ shortfalls. A distinct third status color so "not done yet" never gets confused with "confirmed" (green) or "destructive" (red).

### Named Rules
**The One Accent Rule.** Charred Terracotta appears only where something is actionable or is a live number (buttons, totals, active icons). It never fills a background or decorates a static element. If you're reaching for the accent color and nothing is happening or being acted on, reach for a neutral instead. This survived the legibility pass on purpose: a second saturated hue would compete with the accent for the "this is tappable" signal, which is a bigger usability cost than the surfaces being under-differentiated was. The fix for that was a wider *neutral* ramp, not a second color.

**The Tonal Depth Rule.** Elevation is expressed by stepping through Seasoned Cast Iron, Ash Surface, Ash Surface Raised, and (for momentary pressed states only) Ash Surface Lifted, never by shadow. A more "raised" element is simply a lighter tonal step.

### Light Theme
Same hue family (warm brown, not blue-gray), same component structure, same one-accent rule; every named neutral just gets a Light counterpart rather than a different design:

- **Worn Parchment** (`#ebe7e0`) replaces Seasoned Cast Iron as the base. A toned warm stone, not paper-white and deliberately not the near-white "SaaS cream" this product's own anti-references reject; it's meant to look like a well-used ledger page, not a marketing site.
- **Paper Surface** (`#f9f8f6`), **Paper Surface Raised** (`#e2dfd9`), **Paper Surface Lifted** (`#d3cec5`) replace the three Ash tones.
- **Ink Text** (`#2f261e`) and **Faded Ink** (`#625947`) replace Warm Parchment and Faded Soot.
- **Hairline Brown** (`#8e8167`) replaces Hairline Ash, tuned to the same visible-boundary standard (2.9-3.6:1 against the surfaces it borders) as the dark theme's widened border.
- **Verified Green** (`#24603a`), **Alert Red** (`#a53327`), and **Caution Amber** (bg `#f6e6cb`, text `#864913`, border `#9e662e`) are deepened versions of the dark theme's status colors. Unlike the accent, each status color works as both its own fill and its own ink in both themes, so no ink/fill split was needed there, only new values tuned for a light background.

**The Elevation-Direction Rule (Light only).** In dark mode, "more elevated" means lighter (closer to the ceiling). In light mode, the base itself already sits close to white, so the same upward direction runs out of room fast. Light mode instead makes elevated content surfaces (cards, the topbar) brighter and closer to white than the page behind them, while the surface a finger actually types into (Stock field, stepper) is a step *duller*, like ink sunk into paper rather than a raised tile. Both themes still communicate depth with tone alone, zero shadows; they just don't run the same direction, and that's fine, each theme's internal logic is self-consistent even where the two diverge.

## 3. Typography

**Body Font:** `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif` (system stack, no webfont)

**Character:** One family carries every role from a 26px logo lockup down to a 10.5px field label. A system stack loads instantly and looks native on every staff phone; a ledger doesn't need a typeface with personality, it needs to disappear.

### Hierarchy
- **Display** (700, 26px, 1.1 line-height): the "Mojo's Ordering" wordmark on the branch and supplier screens only. Appears twice in the entire app.
- **Headline** (600, 19px, 1.2): screen-level moments that need weight without being the wordmark, e.g. branch/supplier picker buttons.
- **Title** (600, 17px, 1.2): the topbar's current screen title ("Order Sheet", "Review Order").
- **Body** (400, 14.5px, 1.3): item names, review-line items, all primary reading content. Short by nature (product names), so the usual 65-75ch cap doesn't apply here.
- **Label** (600, 10.5px, 1.2, +0.03em tracking, uppercase): field labels ("PAR", "STOCK", "TO ORDER") and category eyebrow text. Always faded-soot colored, always uppercase, always the smallest weight-bearing text in the system.

### Named Rules
**The Flat Scale Rule.** No fluid or clamp-based sizing anywhere. Staff view this at a fixed distance on a fixed device class (their own phone); a heading that resizes with viewport width solves a problem this product doesn't have.

## 4. Elevation

This system has no shadows at all: zero `box-shadow` declarations anywhere in the stylesheet. Depth is conveyed entirely through tonal layering (Seasoned Cast Iron to Ash Surface to Ash Surface Raised to Ash Surface Lifted) and 1px hairline borders, both now spaced far enough apart to actually read as depth rather than as noise. A flat surface on a dim, low-glare screen in a storage room reads faster than a drop shadow would; shadows are a decoration this product has no use for.

### Named Rules
**The No-Shadow Rule.** If an element needs to look "lifted," step it one tone lighter instead of adding a shadow. There is no exception in this system, including for the confirmation-screen's success icon, which is a flat filled circle, not a shadowed badge.

## 5. Components

Every component is blunt and tappable: large flat surfaces, an obvious pressed state, nothing subtle enough to require a second look. This is not a system that rewards close inspection; it's a system built to be used without looking closely.

### Buttons
- **Shape:** 12px radius (`--radius` variants use the sm/md/lg scale; buttons use md).
- **Primary:** Charred Terracotta background, dark near-black text (`#241206`, not white, kept dark deliberately for contrast), 13px/20px padding, 44px minimum height. Darkens to Charred Terracotta Pressed on `:active`; no hover state exists (touch-only surface).
- **Secondary / Ghost:** transparent background, Charred Terracotta text and 1px border. Used for "Edit" and the confirmation screen's copy-to-clipboard action.
- **Disabled:** 40% opacity, no color change. Used to gate "Review Order" (nothing selected) and "Send Order" (categories not yet marked complete or MOQ unmet).

### Cards / Containers
- **Corner Style:** 14px radius (`--radius`) for top-level cards (categories, branch/supplier picker buttons); 10px for nested elements (par-value, stock input, stepper, combo box).
- **Background:** Ash Surface at rest; switches to Verified Green Background with a Verified Green border when a category is marked complete. That border-and-background pair is the only signal for "done," no shadow, no icon animation.
- **Border:** 1px Hairline Ash by default; category cards get a full-strength status-colored border only when complete.
- **Internal Padding:** 14px-16px horizontal, matching the global `lg` spacing step.
- **Pressed state:** category headers and icon buttons jump to Ash Surface Lifted on `:active`, the same tonal-step language as elevation, so every tap registers visually before the state actually changes.

### Item Rows
- **Answered state:** once an item has a nonzero To Order quantity, its row background tints with a 14% wash of Charred Terracotta and its name goes to weight 600. This is the row-level equivalent of the category-complete signal: a glance down a scrolled list shows what's been touched without reading every number.
- **Skipped state:** a "Skip this item" checkbox on every stocked item lets staff explicitly mark it as not being ordered this time, distinct from just leaving it blank. Checking it hides the Par/Stock/To Order fields, dims and italicizes the item name in Faded Soot, and clears any entered stock or quantity. It counts as "reviewed" the same as entering a real stock number, so an item can be dismissed without forcing a stock count on something that genuinely isn't needed this week.

### Category Auto-Complete
Once every item in a category has been reviewed (a stock count entered, an order quantity set, or explicitly skipped), the category marks itself complete automatically: same collapse-and-advance-to-next-category behavior as tapping "Mark Category Complete" by hand. The manual button still exists for forcing completion early or reopening a completed category, but staff working through a long category shouldn't have to remember an extra tap at the end of every one of a dozen sections.

### Inputs / Fields
- **Style:** Ash Surface Raised background, 1px Hairline Ash border, 10px radius, center-aligned text, 44px height. The stock-count field and the numeric stepper both use this same visual language so they read as one input family, not two different controls.
- **Unset state:** the Par field (read-only, sourced from data, not yet populated for any item) renders in Faded Soot at reduced weight, italic, with a dashed border instead of solid, and shows an em-dash instead of "0". This is the one deliberate exception to "numbers carry the hierarchy": an unset value must look visibly different from a real zero.
- **Focus:** a 2px Charred Terracotta outline with 2px offset on `:focus-visible`, applied globally to buttons, inputs, and links.

### Steppers
- **Style:** a pill-shaped 3-part control (minus / number / plus) sharing the Ash Surface Raised background as the stock/par fields. Minus and plus buttons are 44x44px Charred Terracotta glyphs on transparent backgrounds; the center number is bold Warm Parchment text.
- **State:** `:active` tints the button background with a low-opacity wash of the accent color rather than a full color swap, since these are tapped far more often than any other control in the app and a full-strength flash would be visually noisy at that frequency.

### Icon Buttons
- **Style:** 44x44px, Ash Surface Raised background, 1px Hairline Ash border, 12px radius.
- **Danger variant:** the Clear All button carries a permanent Alert Red border and icon color at rest, distinguishing it from the neutral Change Supplier icon beside it before either is even tapped.
- **Armed/confirming state:** tapping either icon button fills it solid (Alert Red for destructive actions, Charred Terracotta for neutral ones) and surfaces an inline toast below the topbar naming what a second tap will do. A second tap within 3 seconds confirms; otherwise it silently disarms. This replaces the browser's native `confirm()` dialog, keeping the confirmation inside the app's own visual language instead of breaking out to an unstyled system modal.

### Navigation
- **Style:** a single sticky topbar (Ash Surface, 1px bottom border) per screen, carrying a title, optional subtitle, and up to three 44px icon buttons. No side nav, no tab bar; the app is a strict linear flow (branch, then supplier, then order, then review, then confirm) and never needs lateral navigation.
- **Start Over:** a house-glyph icon button on the order and review topbars jumps straight back to branch selection, using the same armed/confirm pattern as Clear All and Change Supplier. It's non-destructive: every field autosaves per branch+supplier as it's typed, so this is a shortcut back to the start, not a wipe. That's also why it needs no stronger warning than the standard two-tap arm.
- **Order Another Supplier:** the confirmation screen's primary action after a successful send, jumping directly to the supplier picker for the same branch rather than back to branch selection. Since a branch visit usually means placing all four supplier orders in one sitting, this is the expected next step, not "Start New Order" (which resets the branch too and is now the secondary action on that screen).
- **Theme Toggle:** a sun/moon icon button in the top-right corner of the branch-selection screen only, the one screen every session passes through. Switching applies instantly across the whole app (it's a single `data-theme` attribute driving every CSS variable) and is remembered per device; the choice is read before the page paints, so there's no flash of the wrong theme on load.

### Status Banners (signature component)
Three status banners share one visual language (rounded rect, colored text on a tinted background of the same hue, no border-radius exceeding 10px) but never share a color: Caution Amber for "not done yet" (incomplete categories, MOQ shortfall, the review-screen send gate), Alert Red only for the two-tap destructive confirmation toast, Verified Green reserved for the category-complete state itself. No banner ever uses the Charred Terracotta accent, keeping "you can act on this" (accent) visually distinct from "here's your status" (amber/red/green).

## 6. Do's and Don'ts

### Do:
- **Do** keep Charred Terracotta reserved for actionable elements and live numbers (buttons, totals, active stepper icons) per the One Accent Rule.
- **Do** express elevation with the three-step tonal ladder (Seasoned Cast Iron, Ash Surface, Ash Surface Raised), never with `box-shadow`.
- **Do** size every tappable control to at least 44x44px; this is a one-handed, phone-in-storage-room tool and undersized targets are a documented usability failure here.
- **Do** use dark text (`#241206`) on Charred Terracotta buttons, not white; white-on-accent fails WCAG AA contrast (measured 3.4:1 against the 4.5:1 requirement).
- **Do** distinguish an unset data value (dashed border, em-dash, italic, Faded Soot) from a real zero. A ledger that can't tell "no data yet" from "confirmed zero" is worse than the spreadsheet it replaced.
- **Do** confirm destructive or disruptive actions with the in-app armed-tap-and-toast pattern, not the browser's native `confirm()`.

### Don't:
- **Don't** add drop shadows, glows, or glassmorphism anywhere; this system is explicitly flat.
- **Don't** build hero-metric tiles, gradient CTAs, or onboarding modals. Per PRODUCT.md, this should not look like a generic SaaS dashboard.
- **Don't** style this like a consumer food-delivery app (Uber Eats/Grab); no browsing affordances, no delight-seeking micro-interactions, no imagery. Per PRODUCT.md's anti-references.
- **Don't** use a second accent color. If a new status is needed, it gets a new named neutral-adjacent tone (as amber was), never a second saturated hue competing with Charred Terracotta.
- **Don't** use border-left or border-right as a colored accent stripe on any card, row, or banner; use full borders, background tints, or nothing.
- **Don't** use white (`#fff`) or pure black (`#000`) anywhere; every neutral in this system is warmed toward the brand hue, however slightly.
