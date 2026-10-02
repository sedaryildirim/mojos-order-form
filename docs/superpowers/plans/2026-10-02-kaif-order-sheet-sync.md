# Kaif order sheet -> GP Calculator sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One action (command or button) pulls the Kaif order sheet's items and prices into the GP Calculator, recalculating every affected dish and batch, and a one-time cleanup leaves only Kaif items.

**Architecture:** A new `src/lib/sync/` module (pack parser, row builder, sync engine) built on the existing price-history, batch-sync and dish-recalculation code. A new nullable `Ingredient.sourceKey` ties each ingredient to its order-sheet item. Command, API route and an Ingredients-page button all call the one engine, preview first, apply second.

**Tech Stack:** Next.js 14, Prisma 6 + Postgres, Vitest (real test database `gp_calculator_test`), tsx for the command.

**Spec:** `docs/superpowers/specs/2026-10-02-kaif-order-sheet-sync-design.md`

## Global Constraints

- Work in `apps/gp-calculator`; commit on branch `order-sheet-sync` (create it in Task 1); never push without the owner saying so.
- Do not change anything under `apps/web`. The sync only reads `config/data.js`.
- The sync never executes fetched JavaScript: `data.js` is parsed with `JSON.parse`.
- The API route reads only the configured URL (`ORDER_SHEET_URL`, default the published Pages file). No user-supplied URLs (SSRF).
- Dry run is the default for the command and the first call of the button; nothing is written until apply.
- Never delete a batch output ingredient (supplier "House-Made", or any ingredient referenced by `BatchRecipe.outputIngredientId`), and never delete an ingredient a recipe or batch line uses: archive it instead.
- Tests use the real test DB; run them with `npm test` from the repo root (it must stay green: 5 dev-server + 195 GP tests at the start).
- Task 8 (the real run) is **destructive**: it must not start until the owner approves the mapping list from Task 7.
- Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- A used ingredient that is not on the sheet is archived, never deleted, and listed (Task 4).
- Batch output ingredients and House-Made items are never deleted or synced (Task 4).
- Re-running the sync with no price changes creates no new dish versions and no price history (Task 4).
- A renamed sheet item (same `sourceKey`) updates in place, no duplicate (Task 4).
- Unreadable pack sizes become "1 EACH, flagged" and are listed, never silently wrong (Task 2).
- Malformed or empty `data.js` aborts with a clear error and changes nothing (Task 3).

## Files

- Modify `prisma/schema.prisma` (+ migration): `Ingredient.sourceKey`.
- Create `src/lib/sync/pack-size.ts`, `src/lib/sync/order-sheet-rows.ts`, `src/lib/sync/order-sheet.ts`, `src/lib/sync/prune.ts`, `src/data/order-sheet-packs.json`, tests beside each.
- Create `scripts/sync-order-sheet.ts`; modify `package.json` (script).
- Create `src/app/api/sync/order-sheet/route.ts` (+ test), `src/components/ingredients/SyncFromOrderSheet.tsx`; modify `src/app/ingredients/page.tsx`.

---

### Task 1: Restore point, branch, `sourceKey` column

**Files:** Modify `prisma/schema.prisma`; Create migration; Modify test DB.

**Interfaces:** Produces `Ingredient.sourceKey: string | null` (unique).

- [ ] **Step 1: Restore point and branch**
```bash
cd /Users/sedaryildirim/mojos-kaif-master-folder && git checkout -b order-sheet-sync
cd apps/gp-calculator && set -a && . ./.env.local && set +a
mkdir -p backups && pg_dump "${DATABASE_URL%%\?*}" > backups/pre-sync-$(date +%Y%m%dT%H%M%S).sql && ls -la backups/pre-sync-*.sql
npm run backup
```
Expected: a non-empty `.sql` file and a JSON backup (both git-ignored).

- [ ] **Step 2: Add the column**: in `model Ingredient` add `sourceKey String? @unique` (after `priceEstimated`).

- [ ] **Step 3: Migrate dev and test databases**
```bash
npx prisma migrate dev --name add_ingredient_source_key
set -a && . ./.env.test && set +a && npx prisma migrate deploy
```
Expected: migration applied to both; `git status` shows a new folder under `prisma/migrations`.

- [ ] **Step 4: Verify and commit**
Run `psql "${DATABASE_URL%%\?*}" -c '\d "Ingredient"' | grep sourceKey` (dev env sourced), then:
```bash
git add prisma && git commit -m "feat(db): Ingredient.sourceKey ties an ingredient to its order-sheet item

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Pack-size parser (TDD)

**Files:** Create `src/lib/sync/pack-size.ts`, `src/lib/sync/pack-size.test.ts`, `src/data/order-sheet-packs.json` (start as `{}`).

**Interfaces:** Produces
```ts
export interface PackSize { purchaseUnit: "G" | "ML" | "EACH"; packQuantity: number; needsPackSize: boolean }
export function parsePackSize(name: string, sheetUnit: string, override?: { purchaseUnit: "G"|"ML"|"EACH"; packQuantity: number }): PackSize
```

- [ ] **Step 1: Failing test** (`pack-size.test.ts`)
```ts
import { describe, expect, it } from "vitest";
import { parsePackSize } from "./pack-size";

describe("parsePackSize", () => {
  it("Kilogram items are 1000 g priced per kg", () => {
    expect(parsePackSize("Chicken Boneless Breast Skin-On 1 kg", "Kilogram")).toEqual({ purchaseUnit: "G", packQuantity: 1000, needsPackSize: false });
  });
  it("reads weights and volumes from the name", () => {
    expect(parsePackSize("ALLOWRIE Butter Product Salted 5 kg", "EACH")).toMatchObject({ purchaseUnit: "G", packQuantity: 5000 });
    expect(parsePackSize("MAINLAND Vintage Cheese 470 g", "EACH")).toMatchObject({ purchaseUnit: "G", packQuantity: 470 });
    expect(parsePackSize("Mascarpone Tatua 1kg", "EACH")).toMatchObject({ purchaseUnit: "G", packQuantity: 1000 });
    expect(parsePackSize("Anchovies Ristoris 700gr", "EACH")).toMatchObject({ purchaseUnit: "G", packQuantity: 700 });
    expect(parsePackSize("HEINZ Apple Vinegar 946 ml", "EACH")).toMatchObject({ purchaseUnit: "ML", packQuantity: 946 });
    expect(parsePackSize("BONUS Palm Oil 18 l", "EACH")).toMatchObject({ purchaseUnit: "ML", packQuantity: 18000 });
  });
  it("multiplies 'x N' multipacks and counts pieces", () => {
    expect(parsePackSize("ARO Frozen Mixed Berries 1 kg x 10", "EACH")).toMatchObject({ purchaseUnit: "G", packQuantity: 10000 });
    expect(parsePackSize("MALEE 100% Mandarin Orange Juice 1 l x 3", "EACH")).toMatchObject({ purchaseUnit: "ML", packQuantity: 3000 });
    expect(parsePackSize("ARO Chicken Egg no.2 with Cover 30 pcs", "EACH")).toMatchObject({ purchaseUnit: "EACH", packQuantity: 30 });
  });
  it("ignores dimensions like 10mm and takes the pack size", () => {
    expect(parsePackSize("SAVEPAK French Fries 10mm 2 kg x 6", "EACH")).toMatchObject({ purchaseUnit: "G", packQuantity: 12000 });
  });
  it("a Bottle is one EACH and needs no flag", () => {
    expect(parsePackSize("VINA TOLDOS Red 2025", "Bottle")).toEqual({ purchaseUnit: "EACH", packQuantity: 1, needsPackSize: false });
  });
  it("flags an unreadable size as 1 EACH", () => {
    expect(parsePackSize("ARO Toilet Tissue 48 rolls", "EACH")).toEqual({ purchaseUnit: "EACH", packQuantity: 1, needsPackSize: true });
  });
  it("an override wins and clears the flag", () => {
    expect(parsePackSize("ARO Toilet Tissue 48 rolls", "EACH", { purchaseUnit: "EACH", packQuantity: 48 })).toEqual({ purchaseUnit: "EACH", packQuantity: 48, needsPackSize: false });
  });
});
```
- [ ] **Step 2: Run it, expect FAIL:** `./node_modules/.bin/vitest run src/lib/sync/pack-size.test.ts --reporter=default` -> cannot find module.
- [ ] **Step 3: Implement**
```ts
export interface PackSize { purchaseUnit: "G" | "ML" | "EACH"; packQuantity: number; needsPackSize: boolean }
type Unit = PackSize["purchaseUnit"];

const SIZE = /(\d+(?:\.\d+)?)\s*(kg|gr|g|ml|l|pcs|pc)\b(?:\s*x\s*(\d+))?/i;

export function parsePackSize(name: string, sheetUnit: string, override?: { purchaseUnit: Unit; packQuantity: number }): PackSize {
  if (override) return { ...override, needsPackSize: false };
  if (sheetUnit === "Kilogram") return { purchaseUnit: "G", packQuantity: 1000, needsPackSize: false };
  if (sheetUnit === "Bottle") return { purchaseUnit: "EACH", packQuantity: 1, needsPackSize: false };
  const m = SIZE.exec(name);
  if (!m) return { purchaseUnit: "EACH", packQuantity: 1, needsPackSize: true };
  const qty = Number(m[1]) * (m[3] ? Number(m[3]) : 1);
  switch (m[2].toLowerCase()) {
    case "kg": return { purchaseUnit: "G", packQuantity: qty * 1000, needsPackSize: false };
    case "g": case "gr": return { purchaseUnit: "G", packQuantity: qty, needsPackSize: false };
    case "l": return { purchaseUnit: "ML", packQuantity: qty * 1000, needsPackSize: false };
    case "ml": return { purchaseUnit: "ML", packQuantity: qty, needsPackSize: false };
    default: return { purchaseUnit: "EACH", packQuantity: qty, needsPackSize: false };
  }
}
```
- [ ] **Step 4: Run, expect PASS**, then `echo '{}' > src/data/order-sheet-packs.json` (create dir if needed).
- [ ] **Step 5: Commit** `git add src/lib/sync src/data && git commit -m "feat(sync): read pack sizes from order-sheet item names"`.

---

### Task 3: Sheet loader and row builder (TDD)

**Files:** Create `src/lib/sync/order-sheet-rows.ts`, `src/lib/sync/order-sheet-rows.test.ts`.

**Interfaces:**
- Consumes: `parsePackSize` (Task 2), `src/data/order-sheet-packs.json`.
- Produces
```ts
export interface SheetRow { sourceKey: string; name: string; category: string; supplier: string; purchaseUnit: "G"|"ML"|"EACH"; packQuantity: number; packPrice: number; needsPackSize: boolean }
export const SYNCED_SUPPLIERS: Record<string, string> // sheet id -> GP supplier name
export function parseOrderSheet(text: string): Record<string, unknown>   // throws Error with a clear message
export function buildRows(data: SheetData, overrides?: Record<string, { purchaseUnit: "G"|"ML"|"EACH"; packQuantity: number }>): SheetRow[]
export async function loadOrderSheetText(source: { file?: string; url?: string }): Promise<string>
export const DEFAULT_ORDER_SHEET_URL: string
```
`SYNCED_SUPPLIERS = { "makro-kaif": "Makro", winepro: "Wine Pro", phangangreenveg: "Phangan Green Vegetables", labottega: "La Bottega", fruitshop: "Boy Fruit Shop" }`.

- [ ] **Step 1: Failing tests**: (a) `parseOrderSheet("const DATA = {\"a\":{\"categories\":[]}};")` returns the object; (b) garbage text and empty object throw `/Could not read the order sheet/`; (c) `buildRows` on a tiny fixture with a Makro Kaif item `{id:"135318", name:"Cauliflower White 1 kg", unit:"Kilogram", price:85}` in category "Vegetables" gives `{sourceKey:"makro-kaif:135318", name, category:"Vegetables", supplier:"Makro", purchaseUnit:"G", packQuantity:1000, packPrice:85, needsPackSize:false}`; (d) suppliers not in `SYNCED_SUPPLIERS` (e.g. `makro-samui`) produce no rows; (e) an override keyed by `sourceKey` is applied; (f) an item with price 0 or non-number is skipped.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement**
```ts
import { readFile } from "node:fs/promises";
import packOverrides from "@/data/order-sheet-packs.json";
import { parsePackSize } from "./pack-size";

export const DEFAULT_ORDER_SHEET_URL = "https://sedaryildirim.github.io/mojos-order-form/config/data.js";
export const SYNCED_SUPPLIERS: Record<string, string> = {
  "makro-kaif": "Makro", winepro: "Wine Pro", phangangreenveg: "Phangan Green Vegetables", labottega: "La Bottega", fruitshop: "Boy Fruit Shop",
};
type Unit = "G" | "ML" | "EACH";
type Override = { purchaseUnit: Unit; packQuantity: number };
export interface SheetItem { id: string | number; name: string; unit: string; price: number }
export type SheetData = Record<string, { categories: { name: string; items: SheetItem[] }[] }>;
export interface SheetRow { sourceKey: string; name: string; category: string; supplier: string; purchaseUnit: Unit; packQuantity: number; packPrice: number; needsPackSize: boolean }

// data.js is `const DATA = {...};`. Parse it as JSON; never execute it.
export function parseOrderSheet(text: string): SheetData {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  try {
    if (start < 0 || end < start) throw new Error("no object found");
    const data = JSON.parse(text.slice(start, end + 1)) as SheetData;
    if (!data || typeof data !== "object" || Object.keys(data).length === 0) throw new Error("empty");
    return data;
  } catch {
    throw new Error("Could not read the order sheet: the file is not in the expected format. Nothing was changed.");
  }
}

export function buildRows(data: SheetData, overrides: Record<string, Override> = packOverrides as Record<string, Override>): SheetRow[] {
  const rows: SheetRow[] = [];
  for (const [sheetId, supplier] of Object.entries(SYNCED_SUPPLIERS)) {
    for (const cat of data[sheetId]?.categories ?? []) {
      for (const item of cat.items) {
        if (typeof item.price !== "number" || !(item.price > 0)) continue;
        const sourceKey = `${sheetId}:${item.id}`;
        const pack = parsePackSize(item.name, item.unit, overrides[sourceKey]);
        rows.push({ sourceKey, name: item.name, category: cat.name, supplier, packPrice: item.price, ...pack });
      }
    }
  }
  return rows;
}

export async function loadOrderSheetText(source: { file?: string; url?: string }): Promise<string> {
  if (source.file) return readFile(source.file, "utf8");
  const res = await fetch(source.url ?? DEFAULT_ORDER_SHEET_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not download the order sheet (HTTP ${res.status}). Nothing was changed.`);
  return res.text();
}
```
Check `tsconfig.json` has `resolveJsonModule` (Next default yes).
- [ ] **Step 4: Run, expect PASS. Step 5: Commit** `feat(sync): load the order sheet and build ingredient rows`.

---

### Task 4: Sync engine (TDD, real test DB)

**Files:** Create `src/lib/sync/order-sheet.ts`, `src/lib/sync/order-sheet.test.ts`.

**Interfaces:**
- Consumes: `SheetRow`, `SYNCED_SUPPLIERS` (Task 3); `recordPriceHistory(id, actor)`; `syncBatchesForIngredients(ids, actor): Promise<string[]>`; `recalculateDishVersionsForIngredients(ids, actor): Promise<RecalcSummary[]>`; `previewPriceChanges(map)` from `@/lib/costing/preview`.
- Produces
```ts
export interface SyncReport {
  applied: boolean;
  created: { name: string; supplier: string }[];
  priceChanged: { name: string; supplier: string; oldPrice: number; newPrice: number }[];
  unchanged: number;
  removed: { name: string; supplier: string }[];
  archivedBecauseUsed: { name: string; supplier: string }[];
  needsPackSize: { name: string; supplier: string }[];
  dishes: PreviewDish[] | RecalcSummary[];
}
export async function syncOrderSheet(rows: SheetRow[], opts: { apply: boolean; actor: string }): Promise<SyncReport>
```
Matching: `sourceKey` first; else `name` + supplier (adopt: sets `sourceKey`). A price change = packPrice, packQuantity or purchaseUnit differs. Removal set = ingredients whose `sourceKey` starts with a synced sheet id prefix (`makro-kaif:` etc.), not in `rows`, not a batch output; delete when unused (delete its `IngredientPriceHistory` first, in one transaction), archive when a `VersionIngredient` or `BatchRecipeLine` uses it.

- [ ] **Step 1: Failing tests** (follow `src/lib/costing/switch.test.ts` for DB setup/cleanup and fixtures). Cases, each using real rows in the test DB:
  1. creates a new ingredient with `sourceKey`, supplier created if missing, `priceHistory` baseline written;
  2. adopts an existing same-name/same-supplier ingredient by setting its `sourceKey` (no duplicate) and keeps its id;
  3. a renamed item (same `sourceKey`, new name) updates the name in place;
  4. a price change updates `packPrice`, records history, and creates a new `DishVersion` for a dish whose latest version uses it (`source` "AUTO_PRICE_REFRESH"), with the new cost;
  5. **idempotent**: running the same rows again creates no dish versions and no extra history rows (`unchanged` = row count);
  6. dry run (`apply:false`) returns the same counts but writes nothing (row counts in `Ingredient`, `DishVersion` unchanged) and lists affected dishes via `previewPriceChanges`;
  7. an ingredient with a synced `sourceKey` missing from the sheet is **deleted** when unused (and its history gone);
  8. the same, but used by a dish line, is **archived** (not deleted) and listed in `archivedBecauseUsed`;
  9. a batch output ingredient is never removed even when its `sourceKey` is absent;
  10. rows with `needsPackSize` appear in `needsPackSize`.
- [ ] **Step 2: Run, expect FAIL** (`./node_modules/.bin/vitest run src/lib/sync/order-sheet.test.ts --reporter=default`).
- [ ] **Step 3: Implement** `syncOrderSheet`:
```ts
import { prisma } from "@/lib/db/prisma";
import { recordPriceHistory } from "@/lib/costing/price-history";
import { syncBatchesForIngredients } from "@/lib/costing/batch";
import { recalculateDishVersionsForIngredients, RecalcSummary } from "@/lib/costing/recalc";
import { previewPriceChanges, PreviewDish } from "@/lib/costing/preview";
import { SheetRow, SYNCED_SUPPLIERS } from "./order-sheet-rows";

export async function syncOrderSheet(rows: SheetRow[], opts: { apply: boolean; actor: string }): Promise<SyncReport> {
  const { apply, actor } = opts;
  const report: SyncReport = { applied: apply, created: [], priceChanged: [], unchanged: 0, removed: [], archivedBecauseUsed: [], needsPackSize: [], dishes: [] };
  const changedIds: string[] = [];
  const previewChanges = new Map<string, { purchaseUnit: "G" | "ML" | "EACH"; packQuantity: number; packPrice: number; yieldPct: number }>();

  for (const row of rows) {
    if (row.needsPackSize) report.needsPackSize.push({ name: row.name, supplier: row.supplier });
    let supplier = await prisma.supplier.findFirst({ where: { name: row.supplier } });
    if (!supplier && apply) supplier = await prisma.supplier.create({ data: { name: row.supplier, createdBy: actor, updatedBy: actor } });
    let existing =
      (await prisma.ingredient.findUnique({ where: { sourceKey: row.sourceKey } })) ??
      (supplier ? await prisma.ingredient.findFirst({ where: { name: row.name, supplierId: supplier.id, sourceKey: null } }) : null);

    if (!existing) {
      report.created.push({ name: row.name, supplier: row.supplier });
      if (apply) {
        const made = await prisma.ingredient.create({
          data: { name: row.name, category: row.category, supplierId: supplier!.id, purchaseUnit: row.purchaseUnit, packQuantity: row.packQuantity, packPrice: row.packPrice, sourceKey: row.sourceKey, createdBy: actor, updatedBy: actor },
        });
        await recordPriceHistory(made.id, actor);
      }
      continue;
    }
    const priceChanged =
      Number(existing.packPrice) !== row.packPrice || Number(existing.packQuantity) !== row.packQuantity || existing.purchaseUnit !== row.purchaseUnit;
    const needsWrite = priceChanged || existing.sourceKey !== row.sourceKey || existing.name !== row.name || existing.category !== row.category || existing.archived || (supplier && existing.supplierId !== supplier.id);
    if (!needsWrite) { report.unchanged++; continue; }
    if (priceChanged) {
      report.priceChanged.push({ name: row.name, supplier: row.supplier, oldPrice: Number(existing.packPrice), newPrice: row.packPrice });
      previewChanges.set(existing.id, { purchaseUnit: row.purchaseUnit, packQuantity: row.packQuantity, packPrice: row.packPrice, yieldPct: Number(existing.yieldPct) });
    } else report.unchanged++;
    if (apply) {
      await prisma.ingredient.update({
        where: { id: existing.id },
        data: { name: row.name, category: row.category, supplierId: supplier!.id, purchaseUnit: row.purchaseUnit, packQuantity: row.packQuantity, packPrice: row.packPrice, sourceKey: row.sourceKey, archived: false, priceEstimated: false, updatedBy: actor },
      });
      if (priceChanged || existing.supplierId !== supplier!.id) await recordPriceHistory(existing.id, actor);
      if (priceChanged) changedIds.push(existing.id);
    }
  }

  // Removals: synced items that are no longer on the sheet.
  const prefixes = Object.keys(SYNCED_SUPPLIERS).map((s) => `${s}:`);
  const keys = new Set(rows.map((r) => r.sourceKey));
  const managed = await prisma.ingredient.findMany({
    where: { OR: prefixes.map((p) => ({ sourceKey: { startsWith: p } })) },
    include: { supplier: true, _count: { select: { versionLines: true, batchLines: true } }, batchOutput: { select: { id: true } } },
  });
  for (const ing of managed) {
    if (keys.has(ing.sourceKey!) || ing.batchOutput) continue;
    const entry = { name: ing.name, supplier: ing.supplier.name };
    if (ing._count.versionLines + ing._count.batchLines > 0) {
      report.archivedBecauseUsed.push(entry);
      if (apply && !ing.archived) await prisma.ingredient.update({ where: { id: ing.id }, data: { archived: true, updatedBy: actor } });
    } else {
      report.removed.push(entry);
      if (apply) await prisma.$transaction([prisma.ingredientPriceHistory.deleteMany({ where: { ingredientId: ing.id } }), prisma.ingredient.delete({ where: { id: ing.id } })]);
    }
  }

  if (apply) {
    const outputs = await syncBatchesForIngredients(changedIds, actor);
    report.dishes = await recalculateDishVersionsForIngredients([...changedIds, ...outputs], actor);
  } else {
    report.dishes = await previewPriceChanges(previewChanges);
  }
  return report;
}
```
The relation names `versionLines`, `batchLines`, `batchOutput` are placeholders: read `prisma/schema.prisma` and use the real back-relation names on `Ingredient` (add explicit back-relations in the schema only if none exist, with a migration). Adjust the `previewChanges` value type to match `PriceChangeInput` in `src/lib/costing/preview.ts`. A row for an `archived` item reappearing on the sheet un-archives it (as written).
- [ ] **Step 4: Run, expect all 10 PASS. Step 5: Commit** `feat(sync): order-sheet sync engine`.

---

### Task 5: The command

**Files:** Create `scripts/sync-order-sheet.ts`; Modify `package.json` (`"sync:order-sheet": "tsx scripts/sync-order-sheet.ts"`).

**Interfaces:** Consumes `loadOrderSheetText`, `parseOrderSheet`, `buildRows`, `syncOrderSheet`. Needs `DATABASE_URL` in the environment (the backup script's pattern).

- [ ] **Step 1: Implement**
```ts
// Pulls the Kaif order sheet into the GP Calculator. Dry run by default.
// Run: npm run sync:order-sheet [-- --apply] [-- --file ../web/config/data.js]
import { buildRows, loadOrderSheetText, parseOrderSheet } from "../src/lib/sync/order-sheet-rows";
import { syncOrderSheet } from "../src/lib/sync/order-sheet";
import { prisma } from "../src/lib/db/prisma";

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const fileIdx = args.indexOf("--file");
  const text = await loadOrderSheetText({ file: fileIdx >= 0 ? args[fileIdx + 1] : undefined });
  const rows = buildRows(parseOrderSheet(text));
  const r = await syncOrderSheet(rows, { apply, actor: "Order sheet sync" });
  console.log(apply ? "APPLIED" : "DRY RUN (nothing written; add --apply)");
  console.log(`${rows.length} sheet items | new ${r.created.length} | price changed ${r.priceChanged.length} | unchanged ${r.unchanged} | removed ${r.removed.length} | archived (still used) ${r.archivedBecauseUsed.length} | need pack size ${r.needsPackSize.length}`);
  for (const p of r.priceChanged) console.log(`  price  ${p.name} (${p.supplier}): ${p.oldPrice} -> ${p.newPrice}`);
  for (const x of r.needsPackSize) console.log(`  PACK?  ${x.name} (${x.supplier})`);
  for (const x of r.archivedBecauseUsed) console.log(`  ARCHIVED (in use) ${x.name} (${x.supplier})`);
  console.log(`  dishes ${apply ? "recalculated" : "that would change"}: ${r.dishes.length}`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
```
- [ ] **Step 2: Check on a bad file**: `npm run sync:order-sheet -- --file package.json` prints "Could not read the order sheet..." and exits non-zero, writing nothing.
- [ ] **Step 3: Commit** `feat(sync): sync:order-sheet command`. (Do not run `--apply` on the real database in this task.)

---

### Task 6: API route and Ingredients-page button

**Files:** Create `src/app/api/sync/order-sheet/route.ts`, `route.test.ts`, `src/components/ingredients/SyncFromOrderSheet.tsx`; Modify `src/app/ingredients/page.tsx` (next to the "Import prices" link, ~line 128).

**Interfaces:** `POST /api/sync/order-sheet` body `{ apply: boolean }` -> `SyncReport` JSON (400 with `{error}` on unreadable sheet).

- [ ] **Step 1: Failing route test** (mock `loadOrderSheetText` with a tiny `const DATA = {...}` fixture): dry run returns `applied:false` and writes nothing; apply creates the ingredient; a bad sheet returns 400 and changes nothing; the route never reads a URL from the request body.
- [ ] **Step 2: Implement route**
```ts
import { buildRows, loadOrderSheetText, parseOrderSheet } from "@/lib/sync/order-sheet-rows";
import { syncOrderSheet } from "@/lib/sync/order-sheet";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const body = z.object({ apply: z.boolean() });

export async function POST(req: NextRequest) {
  const parsed = body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "apply (true/false) is required" }, { status: 400 });
  try {
    const text = await loadOrderSheetText({ url: process.env.ORDER_SHEET_URL });
    const rows = buildRows(parseOrderSheet(text));
    return NextResponse.json(await syncOrderSheet(rows, { apply: parsed.data.apply, actor: "Order sheet sync" }));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Sync failed" }, { status: 400 });
  }
}
```
- [ ] **Step 3: Button component** (client): "Sync from order sheet" -> POST `{apply:false}` -> shows counts (new, price changed, unchanged, removed, archived, need pack size, dishes that would change) and the price-change list -> an "Apply" button posts `{apply:true}` and shows the result; errors shown as text. Mirror the markup style of `src/components/ingredients` neighbours; no new CSS beyond what exists.
- [ ] **Step 4: Add to page**, run `npx tsc --noEmit` and the route test (PASS), then `npm test` from the repo root (all green).
- [ ] **Step 5: Commit** `feat(sync): API route and Sync button on the Ingredients page`.

---

### Task 7: Trial on a copy of the database, and the mapping list

**Files:** none changed in the app; writes `docs/superpowers/plans/2026-10-02-sync-trial-report.md`.

- [ ] **Step 1: Copy the database**: `createdb -T gp_calculator gp_calculator_trial` (stop any session using the source if it refuses; the dev server may be left running only if `createdb` succeeds, otherwise `npm run stop` first and restart after).
- [ ] **Step 2: Point a shell at the copy** (`DATABASE_URL` with `/gp_calculator_trial`, schema applied by the copy) and run `npm run sync:order-sheet -- --file ../web/config/data.js` (dry run) then `--apply`.
- [ ] **Step 3: Measure on the copy**: counts created / price-changed / archived / need-pack-size; every dish's latest cost before vs after; recipes still resolve (no `VersionIngredient` pointing at a deleted row).
- [ ] **Step 4: Build the mapping list**: ingredients used by recipes that are **not** on the sheet and have no `sourceKey`. For each, the best fuzzy sheet match (normalised-name similarity >= 0.84, same purchase unit) as a proposed target, or "no match". Write them, with the dish names that use each, to the trial report.
- [ ] **Step 5: Fill `src/data/order-sheet-packs.json`** for the unreadable items the report lists (non-food and the "gr" cases), re-run the trial, and confirm "need pack size" is empty or accepted by the owner. Commit the JSON.
- [ ] **Step 6: STOP and present** the trial report and the mapping list to the owner. Do not start Task 8 until they approve or edit the mappings.

---

### Task 8: The real run (destructive; only after approval)

- [ ] **Step 1: Restore point**: new `pg_dump` + `npm run backup`; confirm the dump restores into a scratch DB (`createdb gp_restore_check && psql gp_restore_check < dump.sql`, then drop it).
- [ ] **Step 2: `npm run sync:order-sheet` (dry run) on the real DB** and compare with the trial; then `-- --apply`.
- [ ] **Step 3: Apply the approved mappings** with the existing `switchIngredient(fromId, toId, actor)` (each creates new dish versions; history kept). Re-run the sync dry run: everything unchanged.
- [ ] **Step 4: Prune** unused ingredients that are not on the Kaif sheet (`sourceKey` null, not a batch output, no recipe/batch line): delete, with their price history, in one transaction; keep the used ones (archive any that the sync marked) and list them.
- [ ] **Step 5: Verify**: before/after counts (ingredients, dishes, dish versions, batch recipes), every dish's latest cost listed, no recipe line pointing at a missing ingredient, `npm test` green. Report to the owner what was deleted, archived, flagged.
- [ ] **Step 6: Commit** any data-file changes; drop `gp_calculator_trial`. Do not push.
