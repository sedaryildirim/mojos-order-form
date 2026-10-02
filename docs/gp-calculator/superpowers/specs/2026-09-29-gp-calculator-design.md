# GP Calculator — Design Spec

**Date:** 2026-09-29
**Status:** Draft for review

## 1. Purpose

A web app for costing dishes against supplier/ingredient prices and tracking gross profit (GP), replacing manual order-sheet/stock-take-sheet costing. Used by the owner plus a small kitchen/ops team, from any device (desktop, tablet, phone). Core jobs:

- Maintain a live list of suppliers and ingredients with current prices.
- Build a dish's recipe from those ingredients and see its cost, GP%, and GP in Thai Baht (฿) instantly.
- Save named versions of a dish over time, amend them, and compare old vs new spec and GP.
- Share a dish's spec sheet (ingredients, weights, cost) as a link, PDF, Excel file, or email.

## 2. Users & Access

No login/authentication in this version — anyone with the app URL can use it (small trusted team). Every create/edit action (supplier, ingredient, dish, version) has a free-text "created by" / "edited by" name field, typed each time, plus an automatic created/updated timestamp. Per-person accounts and permissions are explicitly out of scope for now (see §8) and can be added later without changing the data model much.

## 3. Currency & Units

- All prices and costs are in Thai Baht (฿), displayed with standard THB formatting (e.g. `฿1,250.00`).
- Ingredients are purchased in one unit (kg, g, L, ml, case, each) at a given pack size/price; recipes consume ingredients in whatever unit makes sense for the dish (g, ml, each). The app converts between them automatically (kg↔g, L↔ml; "case"/"each" units convert via a defined pack quantity, e.g. 1 case = 24 each).
- Each ingredient has an optional **yield %** (default 100%) representing usable quantity after trim/prep/cooking loss. Cost calculations divide by yield% so wastage is reflected in true cost.

## 4. Data Model

**Supplier**
- id, name, contact info (phone/email/notes), archived (bool), created_at, created_by, updated_at, updated_by

**Ingredient**
- id, name, supplier_id (FK), category (free text or simple enum, e.g. Meat/Veg/Dairy/Dry/Other), purchase_unit (kg/g/L/ml/case/each), pack_size (e.g. 1 case = 24 each), purchase_price (฿ per pack_size), yield_pct (default 100), photo (optional), archived (bool), created_at, created_by, updated_at, updated_by

**Dish**
- id, name, category, current_status (active/retired), created_at, created_by

**DishVersion**
- id, dish_id (FK), version_number, notes (amendment description, e.g. "swapped cream for coconut milk"), selling_price (฿, optional), target_gp_pct (optional — used to back-calculate a suggested price if selling_price isn't set), photo (plated dish photo, optional), status (draft/published), created_at, created_by

**VersionIngredient** (join table)
- id, dish_version_id (FK), ingredient_id (FK), quantity, unit (g/ml/each — must be convertible to the ingredient's purchase unit)

Deleting is a **soft delete**: suppliers and ingredients get `archived = true` instead of being removed, so historical dish versions that reference them keep showing correct historical cost/spec. Archived items are hidden from new-dish pickers by default but remain visible when viewing old versions.

## 5. Calculations

- **Ingredient line cost** = (quantity used, converted into the ingredient's purchase unit ÷ yield%) × (purchase_price ÷ pack_size)
- **Dish version cost** = Σ ingredient line costs
- If `selling_price` is set: **GP฿ = selling_price − cost**, **GP% = GP฿ ÷ selling_price**
- If `target_gp_pct` is set instead (no selling price): **suggested selling price = cost ÷ (1 − target_gp_pct)**
- Both fields are editable per version — you can enter either and see the other derived, or override.

## 6. Features

**Suppliers & Ingredients**
- CRUD screens, simple table + form views.
- Ingredient form: name, supplier, category, purchase unit, pack size, purchase price, yield %, optional photo.
- Bulk **import** from CSV/XLSX (your existing order/stock-take sheets): upload → map columns to fields once → create/update records. Re-runnable when prices change (matches on ingredient name + supplier, updates price/fields, adds new rows).

**Dish builder**
- Enter dish name.
- Add ingredients via a searchable dropdown, filterable by supplier and category, so building a recipe from a long ingredient list is fast.
- For each ingredient line: quantity + unit.
- Live-updating cost, GP฿, GP% as you edit.
- Enter selling price or target GP%.
- Optional plated-dish photo.
- Save as a version (v1 first time; subsequent saves prompt "save as new version").

**Versioning**
- Every save creates a new immutable `DishVersion` — nothing is overwritten. Full history of every version is browsable per dish.
- "Amend dish" duplicates the latest version as an editable starting point.
- **Compare view**: pick two versions (typically latest vs previous), see side-by-side ingredient lists with additions/removals/quantity changes highlighted, and old vs new cost/GP฿/GP% with the delta shown.

**Share / export** (per version)
- Shareable read-only link (public, token-based URL) showing the spec sheet: dish name, ingredients + weights, cost, selling price, GP%, photo.
- Downloadable/printable **PDF** of the same spec sheet.
- Downloadable **Excel** (.xlsx) version of the same spec sheet.
- **Send by email** directly from the app: enter a recipient address, app emails the PDF as an attachment.

## 7. Tech Stack

- **Next.js** (App Router) — single deployable app, React UI + API routes.
- **PostgreSQL** (hosted, free tier to start) — relational data model above.
- **Prisma** — ORM/schema migrations.
- **Tailwind CSS** — clean, minimal UI matching your stated preference.
- **Vercel** — hosting.
- **Vercel Blob** — photo storage.
- **Resend** — transactional email (sending spec sheets).
- **xlsx** (SheetJS) — both import (parsing order/stock-take sheets) and export (spec sheet as Excel).
- A PDF-generation library (e.g. `@react-pdf/renderer` or a headless-Chrome print route) for the spec-sheet PDF.

## 8. Non-functional

- Mobile-responsive throughout — kitchen/ops staff will often be on a phone or tablet.
- Clean, minimal UI: generous whitespace, restrained colour, no unnecessary chrome — consistent with the owner's stated design preference.
- Every record (supplier, ingredient, dish, version) is timestamped (created/updated) with a free-text name for who made the change.
- Basic form validation (required fields, positive numbers, valid units) — no complex business-rule validation beyond that.

## 9. Out of scope (v1)

- Login/authentication and per-user permissions (may be added later; data model's free-text "created by" fields are a deliberate stand-in, not a placeholder needing rework).
- Multi-location/multi-brand support (single shared supplier/ingredient/dish catalog).
- Automatic supplier price feeds/APIs (import is manual file upload only).
- Inventory/stock-level tracking (this is a costing tool, not a stock management system).
