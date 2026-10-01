---
name: Mojos + Kaif Suppliers Ordering System
description: Mobile-first stock-order form for Mojos and Kaif back-of-house staff
colors:
  electric-blue: "#0052FF"
  sky-blue: "#4D7CFF"
  button-gradient-end: "#3366F0"
  on-dark-blue: "#9DB8FF"
  canvas: "#FAFAFA"
  slate-ink: "#0F172A"
  muted-surface: "#F1F5F9"
  muted-ink: "#566379"
  card: "#FFFFFF"
  hairline: "#E2E8F0"
  input-border: "#8393A9"
  verified-green: "#15803D"
  verified-green-bg: "#F0FDF4"
  alert-red: "#DC2626"
  warning-solid: "#0B3BA8"
colors-dark:
  canvas: "#0B1120"
  slate-ink: "#F1F5F9"
  muted-surface: "#1A2438"
  muted-ink: "#9AA8BF"
  card: "#121A2C"
  hairline: "#243049"
  input-border: "#5F7190"
  accent-ink: "#7FA2FF"
  verified-green: "#4ADE80"
  verified-green-bg: "#0F2418"
  warning-solid: "#2347B8"
typography:
  display:
    fontFamily: "Calistoga, Georgia, serif"
    fontSize: "clamp(2.1rem, 9vw, 3rem)"
    fontWeight: 400
    lineHeight: 1.05
  title:
    fontFamily: "Calistoga, Georgia, serif"
    fontSize: "19px"
    fontWeight: 400
    lineHeight: 1.15
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.35
  numbers:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "16px"
    fontWeight: 500
  label:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 400
    letterSpacing: "0.08em"
rounded:
  md: "12px"
  lg: "16px"
  full: "999px"
spacing:
  sm: "8px"
  md: "12px"
  lg: "18px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "linear-gradient(135deg, #0052FF, #3366F0)"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    height: "48px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.slate-ink}"
    rounded: "{rounded.md}"
    height: "48px"
  category-card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.lg}"
  input:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.md}"
    height: "48px"
---

# Design System: Mojos + Kaif Suppliers Ordering System

## 1. Overview

**Creative North Star: "Minimalism with a pulse."** Clarity through structure, character through bold detail. The working screens are plain and fast; the first and last screens carry the personality. One electric-blue accent, concentrated, on a near-monochrome slate and white base.

The system follows the Minimalist Modern brief: Calistoga for headlines, Inter for UI, JetBrains Mono for numbers and labels; a signature blue gradient; inverted slate sections for rhythm; texture instead of flatness (dot grid, corner glow); layered soft shadows.

**Where expression is allowed.** Menu, branch and supplier screens (hero) and the confirmation screen. **Where it is not.** The order sheet and review screen: no entrance choreography, no decorative motion; only state changes animate.

**Dark is the default theme.** `[data-theme="light"]` remaps the same tokens; the choice is saved per device and set before first paint (inline script in `index.html`). Toggles live on the menu and branch screens. The browser scrollbar and form controls follow the theme (`scrollbar-color`, `color-scheme`).

## 2. Colors

- **Electric Blue** (`#0052FF`) to **Sky Blue** (`#4D7CFF`): the signature gradient. Used on primary buttons (stopping at `#3366F0` so white text keeps 4.8:1), the `+` stepper button, arrow badges and the confirm tick. On dark surfaces the headline gradient shifts to `#4D7CFF` to `#9DB8FF`.
- **Canvas / Card / Muted Surface**: `#FAFAFA` page, `#FFFFFF` cards, `#F1F5F9` read-only fields (Par). Dark: `#0B1120`, `#121A2C`, `#1A2438`.
- **Slate Ink** (`#0F172A`): text, and the inverted sections (topbar, hero, review total, confirm screen).
- **Muted Ink** (`#566379`): secondary text, 5.8:1 on the canvas.
- **Hairline** (`#E2E8F0`) for dividers; **Input Border** (`#8393A9`) for controls, so fields meet 3:1 under poor lighting.
- **Verified Green**: category complete only. **Alert Red**: destructive actions and their armed state only.
- **Warning**: a solid deep blue (`#0B3BA8` light, `#2347B8` dark) with white text and a white icon chip, so a blocked order is unmistakable and different from the soft blue tints used for info, selection and the resume notice.

### Named Rules
**The Concentrated Accent Rule.** Blue appears where something is actionable, selected or live (buttons, totals, quantities). Static decoration uses slate.
**The Status Ladder.** Soft blue tint = info or selected; solid deep blue = blocked or needs attention; green = done; red = destructive. Never swap them.
**The Inversion Rule.** Slate sections carry white text and the dot texture. Anything on them uses the on-dark tokens, never the light-theme ones.

## 3. Typography

- **Display (Calistoga):** the hero headline, topbar screen titles, the combo patty count, the review total, the confirm heading.
- **UI (Inter 400-700):** item names, buttons, body.
- **Mono (JetBrains Mono):** every figure (par, stock, to order, prices, totals), field labels, region pills, section labels.
- Fixed scale; the hero headline is the only fluid size. Smallest text is 12px.

## 4. Elevation

Soft layered shadows (`0 1px 3px` up to `0 20px 25px`, plus blue-tinted accent shadows on hover) lift cards and primary buttons. Open category cards step up one shadow level. The bottom bar uses a light blur so content slides under it.

## 5. Components

- **Buttons:** 48px, 12px radius. Primary gradient; secondary outlined; disabled is a muted fill with no shadow. Hover lifts 2px (hover-capable devices only); press scales to 0.98.
- **Topbar actions:** 56px wide, icon over a visible label (Clear, Sheet, Home). The destructive one sits apart, with a red outline. Inline SVG icons, one stroke style.
- **Category card:** white card, 16px radius. Open: blue-tinted border. Complete: green border and tint with a ticked circle.
- **Item row:** name and "Skip this item" share the first line; unit and price in mono; Par (read-only, no border), Stock (bordered input) and To Order (stepper, gradient `+`) below. A row with a quantity gets a light blue tint, no side stripe.
- **Combo box:** dashed blue border, Calistoga patty count; mismatched state uses a solid blue border and warning ink.
- **Status bars:** the incomplete-categories bar (fixed above the bottom bar, scrolls if long) and the review gate notice use the solid warning blue.
- **Confirm screen:** one primary action (gradient edge that slowly circulates), secondary actions below. The tick draws once.
- **Launcher cards:** 16px radius, mono kicker, 22px title; the live card gets a blue-tinted border and arrow badge, work-in-progress cards use the muted surface with muted ink.
- **Hero field:** dot grid that lights up under a finger or cursor, drifting when idle (`js/shell/hero-fx.js`).
- **Focus:** 2px ring, light blue on slate surfaces, electric blue elsewhere. Screen changes move focus to the new heading (`js/shell/a11y.js`). `js/shell/launcher.js` wires the menu and always opens the app on the menu.

### Screens and titles
- **Menu (first screen, every load):** hero title "Mojos + Kaif / GP Calculator and Ordering System", then three cards in order: Kaif GP Calculator, Mojos GP Calculator, Ordering. Calculator cards are greyed, flat, disabled, with a "Work in progress" tag; Ordering has the arrow badge and opens the branch picker.
- **Branch picker:** "Mojo's & Kaif / Select a store location", no sub-line. Region pills group the branches; Kaif Chaloklum sits under a second "Koh Phangan" pill. A "Menu" back button returns to the menu.
- **Supplier picker:** "Select a / supplier". The branch sub-line is kept in the DOM but hidden.
- **Hero titles:** the white text and the gradient text are always on separate lines. The hero has square corners (no rounded corner).
- **Order screen header:** topbar, toast and search sit in one sticky block (`.sticky-head`), so no height is hard-coded.

## 6. Do's and Don'ts

### Do
- Keep every tappable control at 44px or larger.
- Pair every state colour with an icon or text.
- Put new colours in the tokens at the top of `css/styles.css`.
- Respect `prefers-reduced-motion` (it switches all animation off).

### Don't
- Don't add entrance animation or decoration to the order and review screens.
- Don't use the warning blue for ordinary info, or the soft tint for blocking problems.
- Don't put light-theme tokens on slate surfaces.
- Don't disable pinch-zoom.

### GP Calculator
The Kaif GP Calculator in `gp-calculator/` uses this same system (dark default, slate and electric blue, Calistoga / Inter / JetBrains Mono). It is all working screens, so it uses none of the hero, glow or entrance motion. See `gp-calculator/DESIGN.md`.
