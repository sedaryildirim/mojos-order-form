# GP Calculator — Dish Costing, Versioning & Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the dish builder, version history/compare, photo attachment, and share/PDF/Excel/email export on top of the Supplier/Ingredient catalog from `2026-09-29-foundation-catalog.md`.

**Architecture:** Every save of a dish creates a new, immutable `DishVersion` row with a **cost snapshot** — the total cost is computed once at save time from the ingredients' *current* prices and stored, rather than recalculated later. This is what makes "view old recipes" (spec §2) accurate even after ingredient prices change or an ingredient is archived: an old version's cost never silently drifts. GP£/GP% and "suggested price from target GP%" are *not* separately stored — they're always derived on read from `costSnapshot` plus whichever of `sellingPrice`/`targetGpPct` is set, via the pure functions added to `lib/costing.ts` in Task 2. This keeps GP display logic in one place and avoids two numbers (a stored GP and a recomputed GP) ever disagreeing.

**Tech Stack:** Builds on the foundation plan's Next.js/Prisma/Postgres/Vitest/zod stack. Adds `@vercel/blob` (photo storage), `@react-pdf/renderer` (PDF export), `resend` (email).

**Spec:** `docs/superpowers/specs/2026-09-29-gp-calculator-design.md`

**Depends on:** `docs/superpowers/plans/2026-09-29-foundation-catalog.md` — reuses `src/lib/prisma.ts`, `src/lib/units.ts`, `src/lib/costing.ts` (`unitCost`, `lineCost`, `IngredientPricing`), `src/lib/currency.ts`, `src/lib/validation.ts`, and the `Supplier`/`Ingredient` Prisma models.

## Global Constraints

- Money and GP formatting always via `formatTHB()` from the foundation plan — never hand-format ฿ amounts.
- `costSnapshot` on a `DishVersion` is written once at creation and never recalculated or edited — it is the historical record (see Architecture above).
- `targetGpPct` must be strictly less than 100 (spec review: 100%+ makes `suggestedPrice = cost / (1 - targetGpPct/100)` divide by zero or go negative) — enforced in `dishVersionInputSchema` with `max(99)`.
- No login (per spec §2): every `DishVersion` has a free-text `createdBy`, exactly like Supplier/Ingredient in the foundation plan.
- Every `DishVersion` gets an unguessable `shareToken` at creation, used by the public share link (Task 10) — never expose Prisma's internal `id` on the public route.

## Review Focus

- Creating a new version after an ingredient's price changed since the previous version — the previous version's `costSnapshot` must be unchanged when re-fetched.
- A version with no `sellingPrice` and no `targetGpPct` set — GP display must show a clear "—" / "not set" state, never `NaN`, `Infinity`, or a crash.
- A `targetGpPct` of 100 or more submitted via the API directly (bypassing the UI) — must be rejected with a 400, not silently produce a negative suggested price.
- Comparing two versions where a line was removed entirely (present in old, absent in new) — the diff must list it as "removed", not omit it.
- Sending a spec sheet email to a malformed address (e.g. `"not-an-email"`) — must return a clear validation error before calling Resend, not fail inside the email provider or crash the route.

---

## File Structure

```
gp-calculator/
  prisma/schema.prisma          # extended: Dish, DishVersion, VersionIngredient, RecipeUnit
  src/
    lib/
      costing.ts                 # extended: dishVersionCost, gpFromSellingPrice, suggestedPriceFromTargetGp
      validation.ts              # extended: dishInputSchema, dishVersionInputSchema
      diff.ts                    # diffVersionLines()
      pdf.tsx                    # renderSpecSheetPdf()
      xlsx-export.ts             # buildSpecSheetWorkbook()
      email.ts                   # sendSpecSheetEmail()
    app/
      dishes/
        page.tsx                 # dish list
        new/page.tsx             # create dish -> redirect to build v1
        [id]/page.tsx            # version history for a dish
        [id]/versions/new/page.tsx        # build a new/amended version
        [id]/versions/[versionId]/page.tsx # view one version's spec sheet
        [id]/compare/page.tsx     # pick 2 versions, side-by-side diff
      share/[token]/page.tsx     # public read-only spec sheet
      api/
        dishes/route.ts
        dishes/[id]/route.ts
        dishes/[id]/versions/route.ts
        dish-versions/[id]/route.ts
        dish-versions/[id]/photo/route.ts
        dish-versions/[id]/pdf/route.ts
        dish-versions/[id]/xlsx/route.ts
        dish-versions/[id]/email/route.ts
        share/[token]/route.ts
    components/
      IngredientPicker.tsx
      DishVersionForm.tsx
      SpecSheet.tsx
      VersionCompare.tsx
```

---

### Task 1: Extend Prisma schema (Dish, DishVersion, VersionIngredient)

**Files:**
- Modify: `prisma/schema.prisma`
- Test: `src/lib/prisma.test.ts` (extend)

**Interfaces:**
- Consumes: `Supplier`, `Ingredient` models (foundation plan Task 2).
- Produces: `Dish`, `DishVersion`, `VersionIngredient`, `RecipeUnit`, `VersionStatus` Prisma types used by every later task.

- [ ] **Step 1: Add the models**

Append to `prisma/schema.prisma`:

```prisma
enum RecipeUnit {
  G
  KG
  ML
  L
  EACH
}

enum VersionStatus {
  DRAFT
  PUBLISHED
}

model Dish {
  id        String        @id @default(cuid())
  name      String
  category  String
  createdAt DateTime      @default(now())
  createdBy String
  versions  DishVersion[]
}

model DishVersion {
  id            String              @id @default(cuid())
  dishId        String
  dish          Dish                @relation(fields: [dishId], references: [id])
  versionNumber Int
  notes         String?
  sellingPrice  Decimal?            @db.Decimal(10, 2)
  targetGpPct   Decimal?            @db.Decimal(5, 2)
  costSnapshot  Decimal             @db.Decimal(10, 2)
  photoUrl      String?
  status        VersionStatus       @default(DRAFT)
  shareToken    String              @unique @default(cuid())
  createdAt     DateTime            @default(now())
  createdBy     String
  lines         VersionIngredient[]

  @@unique([dishId, versionNumber])
}

model VersionIngredient {
  id                     String      @id @default(cuid())
  dishVersionId          String
  dishVersion            DishVersion @relation(fields: [dishVersionId], references: [id])
  ingredientId           String
  ingredient             Ingredient  @relation(fields: [ingredientId], references: [id])
  ingredientNameSnapshot String
  quantity               Decimal     @db.Decimal(10, 3)
  unit                   RecipeUnit
  lineCostSnapshot       Decimal     @db.Decimal(10, 2)
}
```

Also add the back-reference on the existing `Ingredient` model (find the `model Ingredient { ... }` block from the foundation plan and add one field inside it):

```prisma
  versionLines VersionIngredient[]
```

- [ ] **Step 2: Run the migration**

Run: `npx prisma migrate dev --name dish_versions`
Expected: migration applies cleanly.

- [ ] **Step 3: Extend the Prisma smoke test**

Add to `src/lib/prisma.test.ts`:

```typescript
test("creates a dish version with a line and reads it back", async () => {
  const supplier = await prisma.supplier.create({ data: { name: "Fresh Farms Co", createdBy: "S", updatedBy: "S" } });
  const onions = await prisma.ingredient.create({
    data: { name: "Onions", category: "Veg", supplierId: supplier.id, purchaseUnit: "G", packQuantity: 5000, packPrice: 200, createdBy: "S", updatedBy: "S" },
  });
  const dish = await prisma.dish.create({ data: { name: "Onion Soup", category: "Starter", createdBy: "S" } });
  const version = await prisma.dishVersion.create({
    data: {
      dishId: dish.id, versionNumber: 1, costSnapshot: 10, createdBy: "S",
      lines: { create: [{ ingredientId: onions.id, ingredientNameSnapshot: "Onions", quantity: 250, unit: "G", lineCostSnapshot: 10 }] },
    },
    include: { lines: true },
  });
  expect(version.lines).toHaveLength(1);
  expect(version.shareToken).toBeTruthy();
});
```

Also add `await prisma.dishVersion.deleteMany(); await prisma.dish.deleteMany();` to the top of the existing `afterEach` (before the ingredient/supplier cleanup, since versions reference ingredients).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- prisma`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Dish, DishVersion, VersionIngredient schema"
```

---

### Task 2: Dish-level costing functions

**Files:**
- Modify: `src/lib/costing.ts`
- Test: `src/lib/costing.test.ts` (extend)

**Interfaces:**
- Consumes: `IngredientPricing`, `lineCost` (already in `src/lib/costing.ts`), `Unit` from `src/lib/units.ts`.
- Produces: `interface RecipeLine { pricing: IngredientPricing; quantity: number; unit: Unit }`, `dishVersionCost(lines: RecipeLine[]): number`, `gpFromSellingPrice(cost: number, sellingPrice: number | null | undefined): { gpThb: number; gpPct: number } | null`, `suggestedPriceFromTargetGp(cost: number, targetGpPct: number): number`. These are what every dish-version API/UI task uses to turn stored data into displayed numbers.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/costing.test.ts`:

```typescript
import { dishVersionCost, gpFromSellingPrice, suggestedPriceFromTargetGp } from "./costing";

const onions = { purchaseUnit: "G" as const, packQuantity: 5000, packPrice: 200, yieldPct: 100 };
const milk = { purchaseUnit: "ML" as const, packQuantity: 1000, packPrice: 45, yieldPct: 100 };

test("dishVersionCost sums every line", () => {
  const cost = dishVersionCost([
    { pricing: onions, quantity: 250, unit: "G" },
    { pricing: milk, quantity: 500, unit: "ML" },
  ]);
  expect(cost).toBeCloseTo(10 + 22.5, 5);
});

test("dishVersionCost of an empty recipe is 0", () => {
  expect(dishVersionCost([])).toBe(0);
});

test("gpFromSellingPrice computes GP baht and GP percent", () => {
  const gp = gpFromSellingPrice(32.5, 130);
  expect(gp?.gpThb).toBeCloseTo(97.5, 5);
  expect(gp?.gpPct).toBeCloseTo(0.75, 5);
});

test("gpFromSellingPrice returns null when no selling price is set", () => {
  expect(gpFromSellingPrice(32.5, null)).toBeNull();
  expect(gpFromSellingPrice(32.5, undefined)).toBeNull();
  expect(gpFromSellingPrice(32.5, 0)).toBeNull();
});

test("suggestedPriceFromTargetGp back-calculates a selling price", () => {
  expect(suggestedPriceFromTargetGp(32.5, 75)).toBeCloseTo(130, 5);
});

test("suggestedPriceFromTargetGp rejects a target of 100 or more", () => {
  expect(() => suggestedPriceFromTargetGp(32.5, 100)).toThrow(/target gp/i);
  expect(() => suggestedPriceFromTargetGp(32.5, 150)).toThrow(/target gp/i);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- costing`
Expected: FAIL (functions not defined)

- [ ] **Step 3: Implement**

`src/lib/costing.ts` already has `import { convert, Unit } from "./units";` at its top (from the foundation plan's Task 5) — leave that line as-is and append the following below the existing `lineCost` function, with no new import statement:

```typescript
export interface RecipeLine {
  pricing: IngredientPricing;
  quantity: number;
  unit: Unit;
}

export function dishVersionCost(lines: RecipeLine[]): number {
  return lines.reduce((sum, line) => sum + lineCost(line.pricing, line.quantity, line.unit), 0);
}

export function gpFromSellingPrice(
  cost: number,
  sellingPrice: number | null | undefined
): { gpThb: number; gpPct: number } | null {
  if (!sellingPrice || sellingPrice <= 0) return null;
  const gpThb = sellingPrice - cost;
  return { gpThb, gpPct: gpThb / sellingPrice };
}

export function suggestedPriceFromTargetGp(cost: number, targetGpPct: number): number {
  if (targetGpPct >= 100 || targetGpPct < 0) {
    throw new Error("Target GP% must be between 0 and 99");
  }
  return cost / (1 - targetGpPct / 100);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- costing`
Expected: PASS (all costing tests, foundation + new)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add dish-level cost and GP calculation functions"
```

---

### Task 3: Dish API (create, list)

**Files:**
- Create: `src/app/api/dishes/route.ts`
- Create: `src/app/api/dishes/[id]/route.ts`
- Test: `src/app/api/dishes/route.test.ts`

**Interfaces:**
- Consumes: `prisma`.
- Produces: `POST /api/dishes` (create, no version yet), `GET /api/dishes` (list, each with its latest version's cost/GP summary), `GET /api/dishes/:id` (single dish + all versions ordered newest-first).

- [ ] **Step 1: Add the validation schema**

Append to `src/lib/validation.ts`:

```typescript
export const dishInputSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  createdBy: z.string().min(1, "Your name is required"),
});
export type DishInput = z.infer<typeof dishInputSchema>;
```

- [ ] **Step 2: Write the failing test**

`src/app/api/dishes/route.test.ts`:

```typescript
import { prisma } from "@/lib/prisma";
import { afterEach, expect, test } from "vitest";
import { GET, POST } from "./route";
import { NextRequest } from "next/server";

afterEach(async () => {
  await prisma.dishVersion.deleteMany();
  await prisma.dish.deleteMany();
});

test("POST creates a dish with no versions", async () => {
  const req = new NextRequest("http://localhost/api/dishes", {
    method: "POST",
    body: JSON.stringify({ name: "Onion Soup", category: "Starter", createdBy: "Sedary" }),
  });
  const res = await POST(req);
  expect(res.status).toBe(201);
  const body = await res.json();
  expect(body.name).toBe("Onion Soup");
});

test("GET lists dishes with their latest version summary", async () => {
  const dish = await prisma.dish.create({ data: { name: "Onion Soup", category: "Starter", createdBy: "S" } });
  await prisma.dishVersion.create({ data: { dishId: dish.id, versionNumber: 1, costSnapshot: 10, sellingPrice: 40, createdBy: "S" } });
  await prisma.dishVersion.create({ data: { dishId: dish.id, versionNumber: 2, costSnapshot: 12, sellingPrice: 45, createdBy: "S" } });

  const res = await GET();
  const body = await res.json();
  expect(body).toHaveLength(1);
  expect(body[0].versions[0].versionNumber).toBe(2); // newest first
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- api/dishes/route`
Expected: FAIL (module not found)

- [ ] **Step 4: Implement**

`src/app/api/dishes/route.ts`:

```typescript
import { prisma } from "@/lib/prisma";
import { dishInputSchema } from "@/lib/validation";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const dishes = await prisma.dish.findMany({
    orderBy: { name: "asc" },
    include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
  });
  return NextResponse.json(dishes);
}

export async function POST(req: NextRequest) {
  const json = await req.json();
  const parsed = dishInputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const dish = await prisma.dish.create({ data: parsed.data });
  return NextResponse.json(dish, { status: 201 });
}
```

`src/app/api/dishes/[id]/route.ts`:

```typescript
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const dish = await prisma.dish.findUnique({
    where: { id: params.id },
    include: { versions: { orderBy: { versionNumber: "desc" }, include: { lines: true } } },
  });
  if (!dish) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(dish);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- api/dishes/route`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add Dish API for creating and listing dishes"
```

---

### Task 4: DishVersion API (save a version with recipe lines)

**Files:**
- Create: `src/app/api/dishes/[id]/versions/route.ts`
- Create: `src/app/api/dish-versions/[id]/route.ts`
- Test: `src/app/api/dishes/[id]/versions/route.test.ts`

**Interfaces:**
- Consumes: `prisma`, `dishVersionCost`, `lineCost` (Task 2), `IngredientPricing`.
- Produces: `dishVersionInputSchema`, `POST /api/dishes/:id/versions` (computes and stores `costSnapshot` + per-line `lineCostSnapshot`, auto-incrementing `versionNumber`), `GET /api/dish-versions/:id` (single version with lines, dish, and derived GP fields).

- [ ] **Step 1: Add the validation schema**

Append to `src/lib/validation.ts`:

```typescript
export const dishVersionInputSchema = z.object({
  notes: z.string().optional(),
  sellingPrice: z.number().positive().optional(),
  targetGpPct: z.number().min(0).max(99).optional(),
  createdBy: z.string().min(1, "Your name is required"),
  lines: z
    .array(
      z.object({
        ingredientId: z.string().min(1),
        quantity: z.number().positive("Quantity must be greater than 0"),
        unit: z.enum(["G", "KG", "ML", "L", "EACH"]),
      })
    )
    .min(1, "A dish needs at least one ingredient"),
});
export type DishVersionInput = z.infer<typeof dishVersionInputSchema>;
```

- [ ] **Step 2: Write the failing test**

`src/app/api/dishes/[id]/versions/route.test.ts`:

```typescript
import { prisma } from "@/lib/prisma";
import { afterEach, expect, test } from "vitest";
import { POST } from "./route";
import { NextRequest } from "next/server";

afterEach(async () => {
  await prisma.dishVersion.deleteMany();
  await prisma.dish.deleteMany();
  await prisma.ingredient.deleteMany();
  await prisma.supplier.deleteMany();
});

async function setup() {
  const supplier = await prisma.supplier.create({ data: { name: "Fresh Farms Co", createdBy: "S", updatedBy: "S" } });
  const onions = await prisma.ingredient.create({
    data: { name: "Onions", category: "Veg", supplierId: supplier.id, purchaseUnit: "G", packQuantity: 5000, packPrice: 200, createdBy: "S", updatedBy: "S" },
  });
  const dish = await prisma.dish.create({ data: { name: "Onion Soup", category: "Starter", createdBy: "S" } });
  return { onions, dish };
}

test("POST computes and stores a cost snapshot for the version and its lines", async () => {
  const { onions, dish } = await setup();
  const req = new NextRequest(`http://localhost/api/dishes/${dish.id}/versions`, {
    method: "POST",
    body: JSON.stringify({
      sellingPrice: 40, createdBy: "Sedary",
      lines: [{ ingredientId: onions.id, quantity: 250, unit: "G" }],
    }),
  });
  const res = await POST(req, { params: { id: dish.id } });
  expect(res.status).toBe(201);
  const body = await res.json();
  expect(Number(body.costSnapshot)).toBeCloseTo(10, 5); // 250g * (200/5000)
  expect(body.versionNumber).toBe(1);
  expect(Number(body.lines[0].lineCostSnapshot)).toBeCloseTo(10, 5);
});

test("a later version's cost is unaffected by a subsequent ingredient price change", async () => {
  const { onions, dish } = await setup();
  const firstReq = new NextRequest(`http://localhost/api/dishes/${dish.id}/versions`, {
    method: "POST",
    body: JSON.stringify({ createdBy: "Sedary", lines: [{ ingredientId: onions.id, quantity: 250, unit: "G" }] }),
  });
  const firstVersion = await (await POST(firstReq, { params: { id: dish.id } })).json();

  await prisma.ingredient.update({ where: { id: onions.id }, data: { packPrice: 400 } }); // price doubles

  const refetched = await prisma.dishVersion.findUnique({ where: { id: firstVersion.id } });
  expect(Number(refetched?.costSnapshot)).toBeCloseTo(10, 5); // unchanged
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- api/dishes/[id]/versions/route`
Expected: FAIL (module not found)

- [ ] **Step 4: Implement**

`src/app/api/dishes/[id]/versions/route.ts`:

```typescript
import { prisma } from "@/lib/prisma";
import { lineCost } from "@/lib/costing";
import { dishVersionInputSchema } from "@/lib/validation";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const json = await req.json();
  const parsed = dishVersionInputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { lines, ...versionFields } = parsed.data;

  const ingredients = await prisma.ingredient.findMany({
    where: { id: { in: lines.map((l) => l.ingredientId) } },
  });
  if (ingredients.length !== lines.length) {
    return NextResponse.json({ error: "One or more ingredients could not be found" }, { status: 400 });
  }

  const lineData = lines.map((line) => {
    const ingredient = ingredients.find((i) => i.id === line.ingredientId)!;
    const cost = lineCost(
      {
        purchaseUnit: ingredient.purchaseUnit,
        packQuantity: Number(ingredient.packQuantity),
        packPrice: Number(ingredient.packPrice),
        yieldPct: Number(ingredient.yieldPct),
      },
      line.quantity,
      line.unit
    );
    return {
      ingredientId: ingredient.id,
      ingredientNameSnapshot: ingredient.name,
      quantity: line.quantity,
      unit: line.unit,
      lineCostSnapshot: cost,
    };
  });

  const costSnapshot = lineData.reduce((sum, l) => sum + l.lineCostSnapshot, 0);

  const latest = await prisma.dishVersion.findFirst({
    where: { dishId: params.id },
    orderBy: { versionNumber: "desc" },
  });

  const version = await prisma.dishVersion.create({
    data: {
      dishId: params.id,
      versionNumber: (latest?.versionNumber ?? 0) + 1,
      costSnapshot,
      ...versionFields,
      lines: { create: lineData },
    },
    include: { lines: true },
  });

  return NextResponse.json(version, { status: 201 });
}
```

`src/app/api/dish-versions/[id]/route.ts`:

```typescript
import { prisma } from "@/lib/prisma";
import { gpFromSellingPrice, suggestedPriceFromTargetGp } from "@/lib/costing";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const version = await prisma.dishVersion.findUnique({
    where: { id: params.id },
    include: { lines: true, dish: true },
  });
  if (!version) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const cost = Number(version.costSnapshot);
  const sellingPrice = version.sellingPrice ? Number(version.sellingPrice) : null;
  const targetGpPct = version.targetGpPct ? Number(version.targetGpPct) : null;

  return NextResponse.json({
    ...version,
    derived: {
      gp: gpFromSellingPrice(cost, sellingPrice),
      suggestedPrice: targetGpPct !== null ? suggestedPriceFromTargetGp(cost, targetGpPct) : null,
    },
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- versions/route`
Expected: PASS (2 tests) — the second test is what pins down the Review Focus item about price-change isolation.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add DishVersion API with immutable cost snapshots"
```

---

### Task 5: Ingredient picker component

**Files:**
- Create: `src/components/IngredientPicker.tsx`
- Test: `src/components/IngredientPicker.test.tsx`

**Interfaces:**
- Consumes: `GET /api/ingredients?supplierId=&category=` (foundation plan Task 8).
- Produces: `<IngredientPicker suppliers={...} categories={...} onSelect={(ingredient) => void} />`, used by `DishVersionForm` (Task 6).

- [ ] **Step 1: Write the failing test**

`src/components/IngredientPicker.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { expect, test, vi, beforeEach } from "vitest";
import { IngredientPicker } from "./IngredientPicker";

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    json: async () => [
      { id: "ing1", name: "Onions", category: "Veg", supplier: { name: "Fresh Farms Co" }, purchaseUnit: "G", packQuantity: "5000", packPrice: "200", yieldPct: "100" },
    ],
  }) as any;
});

test("lists matching ingredients and calls onSelect when clicked", async () => {
  const onSelect = vi.fn();
  render(<IngredientPicker suppliers={[{ id: "sup1", name: "Fresh Farms Co" }]} categories={["Veg"]} onSelect={onSelect} />);

  await waitFor(() => expect(screen.getByText("Onions")).toBeInTheDocument());
  fireEvent.click(screen.getByText("Onions"));

  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "ing1", name: "Onions" }));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- IngredientPicker`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement**

`src/components/IngredientPicker.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

export interface PickableIngredient {
  id: string;
  name: string;
  category: string;
  supplier: { name: string };
  purchaseUnit: "G" | "ML" | "EACH";
  packQuantity: string;
  packPrice: string;
  yieldPct: string;
}

export function IngredientPicker({
  suppliers,
  categories,
  onSelect,
}: {
  suppliers: { id: string; name: string }[];
  categories: string[];
  onSelect: (ingredient: PickableIngredient) => void;
}) {
  const [supplierId, setSupplierId] = useState("");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [ingredients, setIngredients] = useState<PickableIngredient[]>([]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (supplierId) params.set("supplierId", supplierId);
    if (category) params.set("category", category);
    fetch(`/api/ingredients?${params}`)
      .then((r) => r.json())
      .then(setIngredients);
  }, [supplierId, category]);

  const filtered = ingredients.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="rounded border p-3">
      <div className="flex gap-2">
        <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="rounded border px-2 py-1">
          <option value="">All suppliers</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded border px-2 py-1">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 rounded border px-2 py-1" />
      </div>
      <ul className="mt-2 max-h-48 overflow-y-auto divide-y">
        {filtered.map((i) => (
          <li key={i.id}>
            <button type="button" onClick={() => onSelect(i)} className="w-full py-2 text-left hover:bg-gray-50">
              {i.name} <span className="text-sm text-gray-500">· {i.supplier.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- IngredientPicker`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add supplier/category-filterable ingredient picker"
```

---

### Task 6: Dish version builder form (live cost/GP)

**Files:**
- Create: `src/components/DishVersionForm.tsx`
- Test: `src/components/DishVersionForm.test.tsx`

**Interfaces:**
- Consumes: `IngredientPicker` (Task 5), `dishVersionCost`, `gpFromSellingPrice`, `suggestedPriceFromTargetGp` (Task 2), `formatTHB` (foundation plan).
- Produces: `<DishVersionForm suppliers categories initialLines? initialNotes? initialSellingPrice? onSubmit={(payload) => void} />`, used by both the "new version" and "amend" pages (Task 8).

- [ ] **Step 1: Write the failing test**

`src/components/DishVersionForm.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { expect, test, vi, beforeEach } from "vitest";
import { DishVersionForm } from "./DishVersionForm";

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    json: async () => [
      { id: "ing1", name: "Onions", category: "Veg", supplier: { name: "Fresh Farms Co" }, purchaseUnit: "G", packQuantity: "5000", packPrice: "200", yieldPct: "100" },
    ],
  }) as any;
});

test("adding a line and setting a selling price shows live cost and GP", async () => {
  render(<DishVersionForm suppliers={[{ id: "sup1", name: "Fresh Farms Co" }]} categories={["Veg"]} onSubmit={vi.fn()} />);

  await waitFor(() => expect(screen.getByText("Onions")).toBeInTheDocument());
  fireEvent.click(screen.getByText("Onions"));
  fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "250" } });
  fireEvent.change(screen.getByLabelText("Selling price (฿)"), { target: { value: "40" } });

  expect(await screen.findByText(/cost: ฿10\.00/i)).toBeInTheDocument();
  expect(await screen.findByText(/gp: ฿30\.00 \(75\.0%\)/i)).toBeInTheDocument();
});

test("submits the recipe payload with your name and notes", async () => {
  const onSubmit = vi.fn();
  render(<DishVersionForm suppliers={[{ id: "sup1", name: "Fresh Farms Co" }]} categories={["Veg"]} onSubmit={onSubmit} />);

  await waitFor(() => expect(screen.getByText("Onions")).toBeInTheDocument());
  fireEvent.click(screen.getByText("Onions"));
  fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "250" } });
  fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Sedary" } });
  fireEvent.click(screen.getByText("Save version"));

  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
    createdBy: "Sedary",
    lines: [{ ingredientId: "ing1", quantity: 250, unit: "G" }],
  }));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- DishVersionForm`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement**

`src/components/DishVersionForm.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { IngredientPicker, PickableIngredient } from "./IngredientPicker";
import { dishVersionCost, gpFromSellingPrice, RecipeLine } from "@/lib/costing";
import { Unit } from "@/lib/units";
import { formatTHB } from "@/lib/currency";

interface Line {
  ingredientId: string;
  name: string;
  quantity: number;
  unit: Unit;
  pricing: { purchaseUnit: Unit; packQuantity: number; packPrice: number; yieldPct: number };
}

export interface DishVersionPayload {
  notes?: string;
  sellingPrice?: number;
  targetGpPct?: number;
  createdBy: string;
  lines: { ingredientId: string; quantity: number; unit: Unit }[];
}

export function DishVersionForm({
  suppliers,
  categories,
  initialLines,
  initialNotes,
  initialSellingPrice,
  onSubmit,
}: {
  suppliers: { id: string; name: string }[];
  categories: string[];
  initialLines?: Line[];
  initialNotes?: string;
  initialSellingPrice?: number;
  onSubmit: (payload: DishVersionPayload) => void;
}) {
  const [lines, setLines] = useState<Line[]>(initialLines ?? []);
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [sellingPrice, setSellingPrice] = useState<number | undefined>(initialSellingPrice);
  const [targetGpPct, setTargetGpPct] = useState<number | undefined>(undefined);
  const [createdBy, setCreatedBy] = useState("");

  function addIngredient(ingredient: PickableIngredient) {
    setLines((prev) => [
      ...prev,
      {
        ingredientId: ingredient.id,
        name: ingredient.name,
        quantity: 0,
        unit: ingredient.purchaseUnit,
        pricing: {
          purchaseUnit: ingredient.purchaseUnit,
          packQuantity: Number(ingredient.packQuantity),
          packPrice: Number(ingredient.packPrice),
          yieldPct: Number(ingredient.yieldPct),
        },
      },
    ]);
  }

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  const cost = useMemo(() => {
    const recipeLines: RecipeLine[] = lines
      .filter((l) => l.quantity > 0)
      .map((l) => ({ pricing: l.pricing, quantity: l.quantity, unit: l.unit }));
    return dishVersionCost(recipeLines);
  }, [lines]);

  const gp = gpFromSellingPrice(cost, sellingPrice);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      notes: notes || undefined,
      sellingPrice,
      targetGpPct,
      createdBy,
      lines: lines.map((l) => ({ ingredientId: l.ingredientId, quantity: l.quantity, unit: l.unit })),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <IngredientPicker suppliers={suppliers} categories={categories} onSelect={addIngredient} />

      <ul className="space-y-2">
        {lines.map((line, index) => (
          <li key={`${line.ingredientId}-${index}`} className="flex items-center gap-2">
            <span className="flex-1">{line.name}</span>
            <label htmlFor={`qty-${index}`} className="sr-only">Quantity</label>
            <input
              id={`qty-${index}`}
              aria-label="Quantity"
              type="number"
              className="w-24 rounded border px-2 py-1"
              value={line.quantity || ""}
              onChange={(e) => updateLine(index, { quantity: Number(e.target.value) })}
            />
            <span>{line.unit}</span>
            <button type="button" onClick={() => removeLine(index)} className="text-sm text-red-600">Remove</button>
          </li>
        ))}
      </ul>

      <div className="rounded bg-gray-50 p-3">
        <p>Cost: {formatTHB(cost)}</p>
        {gp && <p>GP: {formatTHB(gp.gpThb)} ({(gp.gpPct * 100).toFixed(1)}%)</p>}
        {!gp && <p className="text-gray-500">GP: — (set a selling price)</p>}
      </div>

      <div className="max-w-sm space-y-3">
        <div>
          <label htmlFor="sellingPrice">Selling price (฿)</label>
          <input id="sellingPrice" type="number" className="mt-1 w-full rounded border px-3 py-2"
            value={sellingPrice ?? ""} onChange={(e) => setSellingPrice(e.target.value ? Number(e.target.value) : undefined)} />
        </div>
        <div>
          <label htmlFor="targetGpPct">Or target GP%</label>
          <input id="targetGpPct" type="number" className="mt-1 w-full rounded border px-3 py-2"
            value={targetGpPct ?? ""} onChange={(e) => setTargetGpPct(e.target.value ? Number(e.target.value) : undefined)} />
        </div>
        <div>
          <label htmlFor="notes">Amendment notes</label>
          <textarea id="notes" className="mt-1 w-full rounded border px-3 py-2"
            value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div>
          <label htmlFor="createdBy">Your name</label>
          <input id="createdBy" className="mt-1 w-full rounded border px-3 py-2"
            value={createdBy} onChange={(e) => setCreatedBy(e.target.value)} />
        </div>
      </div>

      <button type="submit" className="rounded bg-black px-4 py-2 text-white">Save version</button>
    </form>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- DishVersionForm`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add dish version builder with live cost/GP calculation"
```

---

### Task 7: Dish pages — create, list, build first version, amend

**Files:**
- Create: `src/app/dishes/page.tsx`
- Create: `src/app/dishes/new/page.tsx`
- Create: `src/app/dishes/[id]/page.tsx`
- Create: `src/app/dishes/[id]/versions/new/page.tsx`

**Interfaces:**
- Consumes: `DishVersionForm` (Task 6), `POST /api/dishes`, `POST /api/dishes/:id/versions`, `GET /api/dishes/:id` (Task 3, 4).

- [ ] **Step 1: Dish creation page**

`src/app/dishes/new/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewDishPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [createdBy, setCreatedBy] = useState("");

  async function handleCreate() {
    const res = await fetch("/api/dishes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, category, createdBy }),
    });
    const dish = await res.json();
    router.push(`/dishes/${dish.id}/versions/new`);
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-xl font-semibold">New dish</h1>
      <div className="mt-6 max-w-md space-y-4">
        <div>
          <label htmlFor="name">Dish name</label>
          <input id="name" className="mt-1 w-full rounded border px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label htmlFor="category">Category</label>
          <input id="category" className="mt-1 w-full rounded border px-3 py-2" value={category} onChange={(e) => setCategory(e.target.value)} />
        </div>
        <div>
          <label htmlFor="createdBy">Your name</label>
          <input id="createdBy" className="mt-1 w-full rounded border px-3 py-2" value={createdBy} onChange={(e) => setCreatedBy(e.target.value)} />
        </div>
        <button onClick={handleCreate} className="rounded bg-black px-4 py-2 text-white">Continue to recipe</button>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Version builder page (handles both first version and amendments)**

`src/app/dishes/[id]/versions/new/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { DishVersionForm, DishVersionPayload } from "@/components/DishVersionForm";

export default function NewDishVersionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const amendFrom = useSearchParams().get("amendFrom"); // a version id to duplicate

  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [initialLines, setInitialLines] = useState<any[] | undefined>(undefined);
  const [ready, setReady] = useState(!amendFrom);

  useEffect(() => {
    fetch("/api/suppliers").then((r) => r.json()).then(setSuppliers);
    fetch("/api/ingredients").then((r) => r.json()).then((ingredients) => {
      setCategories(Array.from(new Set(ingredients.map((i: any) => i.category))));
    });
  }, []);

  useEffect(() => {
    if (!amendFrom) return;
    fetch(`/api/dish-versions/${amendFrom}`)
      .then((r) => r.json())
      .then(async (version) => {
        // Fetch each ingredient's CURRENT pricing (not the old snapshot) so the
        // amend form's live cost/GP preview reflects today's prices. The previous
        // version's own stored costSnapshot is untouched by this — it's a display
        // choice for the new draft only.
        const linesWithCurrentPricing = await Promise.all(
          version.lines.map(async (l: any) => {
            const ingredient = await fetch(`/api/ingredients/${l.ingredientId}`).then((r) => r.json());
            return {
              ingredientId: l.ingredientId,
              name: l.ingredientNameSnapshot,
              quantity: Number(l.quantity),
              unit: l.unit,
              pricing: {
                purchaseUnit: ingredient.purchaseUnit,
                packQuantity: Number(ingredient.packQuantity),
                packPrice: Number(ingredient.packPrice),
                yieldPct: Number(ingredient.yieldPct),
              },
            };
          })
        );
        setInitialLines(linesWithCurrentPricing);
        setReady(true);
      });
  }, [amendFrom]);

  async function handleSubmit(payload: DishVersionPayload) {
    const res = await fetch(`/api/dishes/${id}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) router.push(`/dishes/${id}`);
  }

  if (!ready) return <main className="mx-auto max-w-3xl p-8">Loading previous version…</main>;

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-xl font-semibold">{amendFrom ? "Amend dish" : "Build recipe"}</h1>
      <div className="mt-6">
        <DishVersionForm suppliers={suppliers} categories={categories} initialLines={initialLines} onSubmit={handleSubmit} />
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Dish list page**

`src/app/dishes/page.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatTHB } from "@/lib/currency";

export default function DishesPage() {
  const [dishes, setDishes] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/dishes").then((r) => r.json()).then(setDishes);
  }, []);

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dishes</h1>
        <Link href="/dishes/new" className="rounded bg-black px-4 py-2 text-white">New dish</Link>
      </div>
      <ul className="mt-6 divide-y">
        {dishes.map((d) => {
          const latest = d.versions[0];
          return (
            <li key={d.id} className="flex items-center justify-between py-3">
              <Link href={`/dishes/${d.id}`}>{d.name} <span className="text-sm text-gray-500">v{latest?.versionNumber ?? "–"}</span></Link>
              {latest && <span>{formatTHB(Number(latest.costSnapshot))} cost</span>}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
```

- [ ] **Step 4: Dish detail / version history page**

`src/app/dishes/[id]/page.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { formatTHB } from "@/lib/currency";
import { gpFromSellingPrice } from "@/lib/costing";

export default function DishPage() {
  const { id } = useParams<{ id: string }>();
  const [dish, setDish] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/dishes/${id}`).then((r) => r.json()).then(setDish);
  }, [id]);

  if (!dish) return <main className="mx-auto max-w-3xl p-8">Loading…</main>;

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{dish.name}</h1>
        <Link href={`/dishes/${id}/versions/new?amendFrom=${dish.versions[0]?.id}`} className="rounded bg-black px-4 py-2 text-white">
          Amend dish
        </Link>
      </div>
      <ul className="mt-6 divide-y">
        {dish.versions.map((v: any) => {
          const gp = gpFromSellingPrice(Number(v.costSnapshot), v.sellingPrice ? Number(v.sellingPrice) : null);
          return (
            <li key={v.id} className="py-3">
              <Link href={`/dishes/${id}/versions/${v.id}`}>v{v.versionNumber}</Link>
              <span className="ml-2 text-sm text-gray-500">
                {formatTHB(Number(v.costSnapshot))} cost{gp ? ` · GP ${(gp.gpPct * 100).toFixed(1)}%` : ""}
              </span>
            </li>
          );
        })}
      </ul>
      {dish.versions.length >= 2 && (
        <Link href={`/dishes/${id}/compare?a=${dish.versions[1].id}&b=${dish.versions[0].id}`} className="mt-4 inline-block text-sm underline">
          Compare latest two versions
        </Link>
      )}
    </main>
  );
}
```

- [ ] **Step 5: Manual verification**

Run: `npm run dev`. Create a dish, add two ingredients, set a selling price, save. Confirm the dish page shows v1 with correct cost/GP. Click "Amend dish", change a quantity, save. Confirm v2 appears and v1's numbers are unchanged.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add dish create/list/detail pages and amend flow"
```

---

### Task 8: Spec sheet display component + single-version page

**Files:**
- Create: `src/components/SpecSheet.tsx`
- Create: `src/app/dishes/[id]/versions/[versionId]/page.tsx`
- Test: `src/components/SpecSheet.test.tsx`

**Interfaces:**
- Consumes: `formatTHB`, `gpFromSellingPrice`, `suggestedPriceFromTargetGp`.
- Produces: `<SpecSheet version={...} />`, a pure presentational component reused by the version page (this task), the public share page (Task 10), and the PDF renderer (Task 11) so all three stay visually consistent.

- [ ] **Step 1: Write the failing test**

`src/components/SpecSheet.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { SpecSheet } from "./SpecSheet";

const version = {
  dish: { name: "Onion Soup" },
  versionNumber: 1,
  notes: "First version",
  photoUrl: null,
  costSnapshot: "10.00",
  sellingPrice: "40.00",
  targetGpPct: null,
  lines: [{ id: "l1", ingredientNameSnapshot: "Onions", quantity: "250.000", unit: "G", lineCostSnapshot: "10.00" }],
};

test("shows dish name, ingredients, cost, and GP", () => {
  render(<SpecSheet version={version as any} />);
  expect(screen.getByText("Onion Soup — v1")).toBeInTheDocument();
  expect(screen.getByText(/Onions/)).toBeInTheDocument();
  expect(screen.getByText(/250 G/)).toBeInTheDocument();
  expect(screen.getByText(/Cost: ฿10.00/)).toBeInTheDocument();
  expect(screen.getByText(/GP: ฿30.00 \(75.0%\)/)).toBeInTheDocument();
});

test("shows a 'not set' state when there is no selling price or target", () => {
  render(<SpecSheet version={{ ...version, sellingPrice: null } as any} />);
  expect(screen.getByText(/GP: not set/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- SpecSheet`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement**

`src/components/SpecSheet.tsx`:

```tsx
import { formatTHB } from "@/lib/currency";
import { gpFromSellingPrice, suggestedPriceFromTargetGp } from "@/lib/costing";

export interface SpecSheetVersion {
  dish: { name: string };
  versionNumber: number;
  notes?: string | null;
  photoUrl?: string | null;
  costSnapshot: string;
  sellingPrice?: string | null;
  targetGpPct?: string | null;
  lines: { id: string; ingredientNameSnapshot: string; quantity: string; unit: string; lineCostSnapshot: string }[];
}

export function SpecSheet({ version }: { version: SpecSheetVersion }) {
  const cost = Number(version.costSnapshot);
  const sellingPrice = version.sellingPrice ? Number(version.sellingPrice) : null;
  const targetGpPct = version.targetGpPct ? Number(version.targetGpPct) : null;
  const gp = gpFromSellingPrice(cost, sellingPrice);
  const suggestedPrice = targetGpPct !== null ? suggestedPriceFromTargetGp(cost, targetGpPct) : null;

  return (
    <article className="max-w-2xl">
      <h1 className="text-xl font-semibold">{version.dish.name} — v{version.versionNumber}</h1>
      {version.notes && <p className="mt-1 text-sm text-gray-600">{version.notes}</p>}
      {version.photoUrl && <img src={version.photoUrl} alt={version.dish.name} className="mt-4 max-h-64 rounded" />}

      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500"><th>Ingredient</th><th>Quantity</th><th className="text-right">Cost</th></tr>
        </thead>
        <tbody>
          {version.lines.map((line) => (
            <tr key={line.id} className="border-t">
              <td className="py-2">{line.ingredientNameSnapshot}</td>
              <td>{Number(line.quantity).toString().replace(/\.?0+$/, "")} {line.unit}</td>
              <td className="text-right">{formatTHB(Number(line.lineCostSnapshot))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6 rounded bg-gray-50 p-4">
        <p>Cost: {formatTHB(cost)}</p>
        {sellingPrice && <p>Selling price: {formatTHB(sellingPrice)}</p>}
        {gp ? <p>GP: {formatTHB(gp.gpThb)} ({(gp.gpPct * 100).toFixed(1)}%)</p> : <p>GP: not set</p>}
        {suggestedPrice !== null && <p>Suggested price for {targetGpPct}% target GP: {formatTHB(suggestedPrice)}</p>}
      </div>
    </article>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- SpecSheet`
Expected: PASS (2 tests)

- [ ] **Step 5: Wire up the version page**

`src/app/dishes/[id]/versions/[versionId]/page.tsx`:

```tsx
import { prisma } from "@/lib/prisma";
import { SpecSheet } from "@/components/SpecSheet";
import { notFound } from "next/navigation";

export default async function DishVersionPage({ params }: { params: { versionId: string } }) {
  const version = await prisma.dishVersion.findUnique({
    where: { id: params.versionId },
    include: { lines: true, dish: true },
  });
  if (!version) notFound();

  return (
    <main className="mx-auto max-w-3xl p-8">
      <SpecSheet version={version as any} />
      <div className="mt-6 flex gap-4 text-sm">
        <a href={`/api/dish-versions/${version.id}/pdf`} className="underline">Download PDF</a>
        <a href={`/api/dish-versions/${version.id}/xlsx`} className="underline">Download Excel</a>
        <a href={`/share/${version.shareToken}`} className="underline">Public share link</a>
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add reusable SpecSheet component and version detail page"
```

---

### Task 9: Version compare/diff

**Files:**
- Create: `src/lib/diff.ts`
- Create: `src/components/VersionCompare.tsx`
- Create: `src/app/dishes/[id]/compare/page.tsx`
- Test: `src/lib/diff.test.ts`

**Interfaces:**
- Consumes: nothing beyond plain data shapes.
- Produces: `interface DiffLine { ingredientName: string; status: "added" | "removed" | "changed" | "unchanged"; oldQuantity?: string; newQuantity?: string; unit?: string }`, `diffVersionLines(oldLines, newLines): DiffLine[]`.

- [ ] **Step 1: Write the failing tests**

`src/lib/diff.test.ts`:

```typescript
import { diffVersionLines } from "./diff";
import { expect, test } from "vitest";

const oldLines = [
  { ingredientId: "onion", ingredientNameSnapshot: "Onions", quantity: "250.000", unit: "G" },
  { ingredientId: "cream", ingredientNameSnapshot: "Cream", quantity: "100.000", unit: "ML" },
];

test("flags a removed ingredient", () => {
  const newLines = [oldLines[0]];
  const diff = diffVersionLines(oldLines, newLines);
  expect(diff.find((d) => d.ingredientName === "Cream")).toMatchObject({ status: "removed" });
});

test("flags an added ingredient", () => {
  const newLines = [...oldLines, { ingredientId: "salt", ingredientNameSnapshot: "Salt", quantity: "5.000", unit: "G" }];
  const diff = diffVersionLines(oldLines, newLines);
  expect(diff.find((d) => d.ingredientName === "Salt")).toMatchObject({ status: "added" });
});

test("flags a changed quantity", () => {
  const newLines = [{ ...oldLines[0], quantity: "300.000" }, oldLines[1]];
  const diff = diffVersionLines(oldLines, newLines);
  expect(diff.find((d) => d.ingredientName === "Onions")).toMatchObject({ status: "changed", oldQuantity: "250.000", newQuantity: "300.000" });
});

test("flags an unchanged line", () => {
  const diff = diffVersionLines(oldLines, oldLines);
  expect(diff.every((d) => d.status === "unchanged")).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- diff`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement**

`src/lib/diff.ts`:

```typescript
interface ComparableLine {
  ingredientId: string;
  ingredientNameSnapshot: string;
  quantity: string;
  unit: string;
}

export interface DiffLine {
  ingredientName: string;
  status: "added" | "removed" | "changed" | "unchanged";
  oldQuantity?: string;
  newQuantity?: string;
  unit?: string;
}

export function diffVersionLines(oldLines: ComparableLine[], newLines: ComparableLine[]): DiffLine[] {
  const byIngredient = new Map<string, { old?: ComparableLine; new?: ComparableLine }>();

  for (const line of oldLines) byIngredient.set(line.ingredientId, { old: line });
  for (const line of newLines) {
    const entry = byIngredient.get(line.ingredientId) ?? {};
    entry.new = line;
    byIngredient.set(line.ingredientId, entry);
  }

  const diffs: DiffLine[] = [];
  for (const { old, new: next } of byIngredient.values()) {
    if (old && !next) {
      diffs.push({ ingredientName: old.ingredientNameSnapshot, status: "removed", oldQuantity: old.quantity, unit: old.unit });
    } else if (!old && next) {
      diffs.push({ ingredientName: next.ingredientNameSnapshot, status: "added", newQuantity: next.quantity, unit: next.unit });
    } else if (old && next) {
      const changed = old.quantity !== next.quantity || old.unit !== next.unit;
      diffs.push({
        ingredientName: next.ingredientNameSnapshot,
        status: changed ? "changed" : "unchanged",
        oldQuantity: old.quantity,
        newQuantity: next.quantity,
        unit: next.unit,
      });
    }
  }
  return diffs;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- diff`
Expected: PASS (4 tests)

- [ ] **Step 5: Compare component and page**

`src/components/VersionCompare.tsx`:

```tsx
import { DiffLine } from "@/lib/diff";
import { formatTHB } from "@/lib/currency";
import { gpFromSellingPrice } from "@/lib/costing";

const STATUS_STYLE: Record<DiffLine["status"], string> = {
  added: "bg-green-50 text-green-800",
  removed: "bg-red-50 text-red-800 line-through",
  changed: "bg-yellow-50 text-yellow-800",
  unchanged: "",
};

export function VersionCompare({
  oldVersion,
  newVersion,
  diffs,
}: {
  oldVersion: { versionNumber: number; costSnapshot: string; sellingPrice: string | null };
  newVersion: { versionNumber: number; costSnapshot: string; sellingPrice: string | null };
  diffs: DiffLine[];
}) {
  const oldGp = gpFromSellingPrice(Number(oldVersion.costSnapshot), oldVersion.sellingPrice ? Number(oldVersion.sellingPrice) : null);
  const newGp = gpFromSellingPrice(Number(newVersion.costSnapshot), newVersion.sellingPrice ? Number(newVersion.sellingPrice) : null);

  return (
    <div>
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded bg-gray-50 p-4">
          <h2 className="font-semibold">v{oldVersion.versionNumber}</h2>
          <p>Cost: {formatTHB(Number(oldVersion.costSnapshot))}</p>
          <p>GP: {oldGp ? `${(oldGp.gpPct * 100).toFixed(1)}%` : "not set"}</p>
        </div>
        <div className="rounded bg-gray-50 p-4">
          <h2 className="font-semibold">v{newVersion.versionNumber}</h2>
          <p>Cost: {formatTHB(Number(newVersion.costSnapshot))}</p>
          <p>GP: {newGp ? `${(newGp.gpPct * 100).toFixed(1)}%` : "not set"}</p>
        </div>
      </div>
      <ul className="mt-6 space-y-1">
        {diffs.map((d, i) => (
          <li key={i} className={`rounded px-2 py-1 ${STATUS_STYLE[d.status]}`}>
            {d.ingredientName}: {d.status}
            {d.status === "changed" && ` (${d.oldQuantity} → ${d.newQuantity} ${d.unit})`}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

`src/app/dishes/[id]/compare/page.tsx`:

```tsx
import { prisma } from "@/lib/prisma";
import { diffVersionLines } from "@/lib/diff";
import { VersionCompare } from "@/components/VersionCompare";
import { notFound } from "next/navigation";

export default async function ComparePage({ searchParams }: { searchParams: { a?: string; b?: string } }) {
  if (!searchParams.a || !searchParams.b) notFound();

  const [oldVersion, newVersion] = await Promise.all([
    prisma.dishVersion.findUnique({ where: { id: searchParams.a }, include: { lines: true } }),
    prisma.dishVersion.findUnique({ where: { id: searchParams.b }, include: { lines: true } }),
  ]);
  if (!oldVersion || !newVersion) notFound();

  const diffs = diffVersionLines(oldVersion.lines as any, newVersion.lines as any);

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-xl font-semibold">Compare versions</h1>
      <div className="mt-6">
        <VersionCompare oldVersion={oldVersion as any} newVersion={newVersion as any} diffs={diffs} />
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Manual verification**

From a dish detail page with 2+ versions, click "Compare latest two versions" and confirm added/removed/changed lines are visually distinct.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add version compare/diff view"
```

---

### Task 10: Photo upload + public share link

**Files:**
- Create: `src/app/api/dish-versions/[id]/photo/route.ts`
- Create: `src/app/share/[token]/page.tsx`
- Test: `src/app/api/dish-versions/[id]/photo/route.test.ts`

**Interfaces:**
- Consumes: `@vercel/blob`, `prisma`.
- Produces: `POST /api/dish-versions/:id/photo` (multipart upload, sets `photoUrl`), public route `GET /share/:token` rendering `SpecSheet` read-only via `shareToken` (never the internal id).

- [ ] **Step 1: Install and configure Vercel Blob**

```bash
npm install @vercel/blob
```

Add `BLOB_READ_WRITE_TOKEN=` to `.env.example` (obtained from the Vercel project's Storage tab once deployed; for local dev, `vercel env pull` after linking the project, or stub the upload in tests as below).

- [ ] **Step 2: Write the failing test (mocking Blob)**

`src/app/api/dish-versions/[id]/photo/route.test.ts`:

```typescript
import { prisma } from "@/lib/prisma";
import { afterEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@vercel/blob", () => ({
  put: vi.fn().mockResolvedValue({ url: "https://blob.example.com/photo.jpg" }),
}));

import { POST } from "./route";

afterEach(async () => {
  await prisma.dishVersion.deleteMany();
  await prisma.dish.deleteMany();
});

test("uploads a photo and sets photoUrl on the version", async () => {
  const dish = await prisma.dish.create({ data: { name: "Onion Soup", category: "Starter", createdBy: "S" } });
  const version = await prisma.dishVersion.create({ data: { dishId: dish.id, versionNumber: 1, costSnapshot: 10, createdBy: "S" } });

  const formData = new FormData();
  formData.append("file", new File(["fake-image-bytes"], "plate.jpg", { type: "image/jpeg" }));
  const req = new NextRequest(`http://localhost/api/dish-versions/${version.id}/photo`, { method: "POST", body: formData });

  const res = await POST(req, { params: { id: version.id } });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.photoUrl).toBe("https://blob.example.com/photo.jpg");

  const updated = await prisma.dishVersion.findUnique({ where: { id: version.id } });
  expect(updated?.photoUrl).toBe("https://blob.example.com/photo.jpg");
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- photo/route`
Expected: FAIL (module not found)

- [ ] **Step 4: Implement**

`src/app/api/dish-versions/[id]/photo/route.ts`:

```typescript
import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "file is required" }, { status: 400 });

  const blob = await put(`dish-versions/${params.id}/${file.name}`, file, { access: "public" });

  const version = await prisma.dishVersion.update({
    where: { id: params.id },
    data: { photoUrl: blob.url },
  });
  return NextResponse.json({ photoUrl: version.photoUrl });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- photo/route`
Expected: PASS

- [ ] **Step 6: Public share page**

`src/app/share/[token]/page.tsx`:

```tsx
import { prisma } from "@/lib/prisma";
import { SpecSheet } from "@/components/SpecSheet";
import { notFound } from "next/navigation";

export default async function SharePage({ params }: { params: { token: string } }) {
  const version = await prisma.dishVersion.findUnique({
    where: { shareToken: params.token },
    include: { lines: true, dish: true },
  });
  if (!version) notFound();

  return (
    <main className="mx-auto max-w-3xl p-8">
      <SpecSheet version={version as any} />
    </main>
  );
}
```

- [ ] **Step 7: Add a photo upload control to the version page**

In `src/app/dishes/[id]/versions/[versionId]/page.tsx` (Task 8), this is a server component; add a small client-only `<PhotoUpload versionId={version.id} />` island:

`src/components/PhotoUpload.tsx`:

```tsx
"use client";

import { useState } from "react";

export function PhotoUpload({ versionId }: { versionId: string }) {
  const [uploading, setUploading] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    await fetch(`/api/dish-versions/${versionId}/photo`, { method: "POST", body: formData });
    setUploading(false);
    window.location.reload();
  }

  return (
    <div className="mt-4">
      <label htmlFor="photo">Plated dish photo</label>
      <input id="photo" type="file" accept="image/*" onChange={handleChange} disabled={uploading} />
    </div>
  );
}
```

Add `<PhotoUpload versionId={version.id} />` inside the version page's `<main>`, above the SpecSheet.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add photo upload and public share link"
```

---

### Task 11: PDF export

**Files:**
- Create: `src/lib/pdf.tsx`
- Create: `src/app/api/dish-versions/[id]/pdf/route.ts`
- Test: `src/lib/pdf.test.ts`

**Interfaces:**
- Consumes: `@react-pdf/renderer`, `formatTHB`, `gpFromSellingPrice`.
- Produces: `renderSpecSheetPdf(version): Promise<Buffer>`, used by both the download route (this task) and the email route (Task 13).

- [ ] **Step 1: Install**

```bash
npm install @react-pdf/renderer
```

- [ ] **Step 2: Write the failing test**

`src/lib/pdf.test.ts`:

```typescript
import { renderSpecSheetPdf } from "./pdf";
import { expect, test } from "vitest";

const version = {
  dish: { name: "Onion Soup" },
  versionNumber: 1,
  notes: null,
  costSnapshot: "10.00",
  sellingPrice: "40.00",
  targetGpPct: null,
  lines: [{ id: "l1", ingredientNameSnapshot: "Onions", quantity: "250.000", unit: "G", lineCostSnapshot: "10.00" }],
};

test("renders a non-empty PDF buffer", async () => {
  const buffer = await renderSpecSheetPdf(version as any);
  expect(buffer.length).toBeGreaterThan(0);
  expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- pdf`
Expected: FAIL (module not found)

- [ ] **Step 4: Implement**

`src/lib/pdf.tsx`:

```tsx
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { formatTHB } from "./currency";
import { gpFromSellingPrice } from "./costing";
import { SpecSheetVersion } from "@/components/SpecSheet";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 11 },
  title: { fontSize: 18, marginBottom: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: "#eee" },
  summary: { marginTop: 16, backgroundColor: "#f5f5f5", padding: 12 },
});

export async function renderSpecSheetPdf(version: SpecSheetVersion): Promise<Buffer> {
  const cost = Number(version.costSnapshot);
  const sellingPrice = version.sellingPrice ? Number(version.sellingPrice) : null;
  const gp = gpFromSellingPrice(cost, sellingPrice);

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{version.dish.name} — v{version.versionNumber}</Text>
        {version.notes && <Text>{version.notes}</Text>}
        {version.lines.map((line) => (
          <View key={line.id} style={styles.row}>
            <Text>{line.ingredientNameSnapshot} — {line.quantity} {line.unit}</Text>
            <Text>{formatTHB(Number(line.lineCostSnapshot))}</Text>
          </View>
        ))}
        <View style={styles.summary}>
          <Text>Cost: {formatTHB(cost)}</Text>
          {sellingPrice && <Text>Selling price: {formatTHB(sellingPrice)}</Text>}
          <Text>GP: {gp ? `${formatTHB(gp.gpThb)} (${(gp.gpPct * 100).toFixed(1)}%)` : "not set"}</Text>
        </View>
      </Page>
    </Document>
  );

  return renderToBuffer(doc);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- pdf`
Expected: PASS

- [ ] **Step 6: API route**

`src/app/api/dish-versions/[id]/pdf/route.ts`:

```typescript
import { prisma } from "@/lib/prisma";
import { renderSpecSheetPdf } from "@/lib/pdf";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const version = await prisma.dishVersion.findUnique({ where: { id: params.id }, include: { lines: true, dish: true } });
  if (!version) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const buffer = await renderSpecSheetPdf(version as any);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${version.dish.name}-v${version.versionNumber}.pdf"`,
    },
  });
}
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add PDF export for dish version spec sheets"
```

---

### Task 12: Excel export

**Files:**
- Create: `src/lib/xlsx-export.ts`
- Create: `src/app/api/dish-versions/[id]/xlsx/route.ts`
- Test: `src/lib/xlsx-export.test.ts`

**Interfaces:**
- Consumes: `xlsx` (already installed in the foundation plan), `SpecSheetVersion` shape.
- Produces: `buildSpecSheetWorkbook(version): Buffer`.

- [ ] **Step 1: Write the failing test**

`src/lib/xlsx-export.test.ts`:

```typescript
import * as XLSX from "xlsx";
import { buildSpecSheetWorkbook } from "./xlsx-export";
import { expect, test } from "vitest";

const version = {
  dish: { name: "Onion Soup" },
  versionNumber: 1,
  costSnapshot: "10.00",
  sellingPrice: "40.00",
  targetGpPct: null,
  lines: [{ id: "l1", ingredientNameSnapshot: "Onions", quantity: "250.000", unit: "G", lineCostSnapshot: "10.00" }],
};

test("workbook contains the ingredient row and cost/GP summary", () => {
  const buffer = buildSpecSheetWorkbook(version as any);
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<any>(sheet, { header: 1 });

  const flat = rows.map((r) => r.join(",")).join("\n");
  expect(flat).toContain("Onions");
  expect(flat).toContain("250");
  expect(flat).toContain("Cost");
  expect(flat).toContain("GP");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- xlsx-export`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement**

`src/lib/xlsx-export.ts`:

```typescript
import * as XLSX from "xlsx";
import { gpFromSellingPrice } from "./costing";
import { SpecSheetVersion } from "@/components/SpecSheet";

export function buildSpecSheetWorkbook(version: SpecSheetVersion): Buffer {
  const cost = Number(version.costSnapshot);
  const sellingPrice = version.sellingPrice ? Number(version.sellingPrice) : null;
  const gp = gpFromSellingPrice(cost, sellingPrice);

  const header = [`${version.dish.name} — v${version.versionNumber}`];
  const lineRows = [
    ["Ingredient", "Quantity", "Unit", "Cost (฿)"],
    ...version.lines.map((l) => [l.ingredientNameSnapshot, Number(l.quantity), l.unit, Number(l.lineCostSnapshot)]),
    [],
    ["Cost", cost],
    ...(sellingPrice ? [["Selling price", sellingPrice]] : []),
    ...(gp ? [["GP (฿)", gp.gpThb], ["GP (%)", `${(gp.gpPct * 100).toFixed(1)}%`]] : [["GP", "not set"]]),
  ];

  const sheet = XLSX.utils.aoa_to_sheet([header, [], ...lineRows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Spec sheet");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- xlsx-export`
Expected: PASS

- [ ] **Step 5: API route**

`src/app/api/dish-versions/[id]/xlsx/route.ts`:

```typescript
import { prisma } from "@/lib/prisma";
import { buildSpecSheetWorkbook } from "@/lib/xlsx-export";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const version = await prisma.dishVersion.findUnique({ where: { id: params.id }, include: { lines: true, dish: true } });
  if (!version) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const buffer = buildSpecSheetWorkbook(version as any);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${version.dish.name}-v${version.versionNumber}.xlsx"`,
    },
  });
}
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add Excel export for dish version spec sheets"
```

---

### Task 13: Email send

**Files:**
- Create: `src/lib/email.ts`
- Create: `src/app/api/dish-versions/[id]/email/route.ts`
- Create: `src/components/EmailShareForm.tsx`
- Test: `src/lib/email.test.ts`
- Test: `src/app/api/dish-versions/[id]/email/route.test.ts`

**Interfaces:**
- Consumes: `resend`, `renderSpecSheetPdf` (Task 11).
- Produces: `sendSpecSheetEmail({ to, dishName, versionNumber, pdfBuffer }): Promise<void>`, `POST /api/dish-versions/:id/email` (validates the recipient, renders the PDF, sends it).

- [ ] **Step 1: Install and configure**

```bash
npm install resend
```

Add `RESEND_API_KEY=` and `RESEND_FROM_EMAIL=gp-calculator@yourdomain.com` to `.env.example`.

- [ ] **Step 2: Write the failing test for the email helper**

`src/lib/email.test.ts`:

```typescript
import { expect, test, vi } from "vitest";

vi.mock("resend", () => {
  const send = vi.fn().mockResolvedValue({ data: { id: "email_123" }, error: null });
  return { Resend: vi.fn().mockImplementation(() => ({ emails: { send } })) };
});

import { sendSpecSheetEmail } from "./email";
import { Resend } from "resend";

test("sends an email with the PDF attached", async () => {
  await sendSpecSheetEmail({ to: "chef@example.com", dishName: "Onion Soup", versionNumber: 1, pdfBuffer: Buffer.from("%PDF-fake") });

  const instance = (Resend as any).mock.results[0].value;
  expect(instance.emails.send).toHaveBeenCalledWith(expect.objectContaining({
    to: "chef@example.com",
    subject: expect.stringContaining("Onion Soup"),
    attachments: [expect.objectContaining({ filename: "Onion Soup-v1.pdf" })],
  }));
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- lib/email`
Expected: FAIL (module not found)

- [ ] **Step 4: Implement the helper**

`src/lib/email.ts`:

```typescript
import { Resend } from "resend";

export async function sendSpecSheetEmail({
  to,
  dishName,
  versionNumber,
  pdfBuffer,
}: {
  to: string;
  dishName: string;
  versionNumber: number;
  pdfBuffer: Buffer;
}): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to,
    subject: `${dishName} — spec sheet (v${versionNumber})`,
    text: `Attached is the spec sheet for ${dishName}, version ${versionNumber}.`,
    attachments: [{ filename: `${dishName}-v${versionNumber}.pdf`, content: pdfBuffer }],
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- lib/email`
Expected: PASS

- [ ] **Step 6: Add email validation and the API route**

Append to `src/lib/validation.ts`:

```typescript
export const emailShareSchema = z.object({
  to: z.string().email("Enter a valid email address"),
});
```

`src/app/api/dish-versions/[id]/email/route.ts`:

```typescript
import { prisma } from "@/lib/prisma";
import { renderSpecSheetPdf } from "@/lib/pdf";
import { sendSpecSheetEmail } from "@/lib/email";
import { emailShareSchema } from "@/lib/validation";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const json = await req.json();
  const parsed = emailShareSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const version = await prisma.dishVersion.findUnique({ where: { id: params.id }, include: { lines: true, dish: true } });
  if (!version) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const pdfBuffer = await renderSpecSheetPdf(version as any);
  await sendSpecSheetEmail({ to: parsed.data.to, dishName: version.dish.name, versionNumber: version.versionNumber, pdfBuffer });

  return NextResponse.json({ sent: true });
}
```

- [ ] **Step 7: Write the failing route test**

`src/app/api/dish-versions/[id]/email/route.test.ts`:

```typescript
import { prisma } from "@/lib/prisma";
import { afterEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/email", () => ({ sendSpecSheetEmail: vi.fn().mockResolvedValue(undefined) }));

import { POST } from "./route";
import { sendSpecSheetEmail } from "@/lib/email";

afterEach(async () => {
  await prisma.dishVersion.deleteMany();
  await prisma.dish.deleteMany();
});

test("rejects a malformed email address before sending", async () => {
  const dish = await prisma.dish.create({ data: { name: "Onion Soup", category: "Starter", createdBy: "S" } });
  const version = await prisma.dishVersion.create({ data: { dishId: dish.id, versionNumber: 1, costSnapshot: 10, createdBy: "S" } });

  const req = new NextRequest(`http://localhost/api/dish-versions/${version.id}/email`, {
    method: "POST",
    body: JSON.stringify({ to: "not-an-email" }),
  });
  const res = await POST(req, { params: { id: version.id } });

  expect(res.status).toBe(400);
  expect(sendSpecSheetEmail).not.toHaveBeenCalled();
});

test("sends the email for a valid address", async () => {
  const dish = await prisma.dish.create({ data: { name: "Onion Soup", category: "Starter", createdBy: "S" } });
  const version = await prisma.dishVersion.create({ data: { dishId: dish.id, versionNumber: 1, costSnapshot: 10, createdBy: "S" } });

  const req = new NextRequest(`http://localhost/api/dish-versions/${version.id}/email`, {
    method: "POST",
    body: JSON.stringify({ to: "chef@example.com" }),
  });
  const res = await POST(req, { params: { id: version.id } });

  expect(res.status).toBe(200);
  expect(sendSpecSheetEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "chef@example.com", dishName: "Onion Soup" }));
});
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npm test -- dish-versions/[id]/email/route`
Expected: PASS (2 tests) — the first pins the "malformed email" Review Focus item.

- [ ] **Step 9: Share form on the version page**

`src/components/EmailShareForm.tsx`:

```tsx
"use client";

import { useState } from "react";

export function EmailShareForm({ versionId }: { versionId: string }) {
  const [to, setTo] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleSend() {
    setStatus("sending");
    const res = await fetch(`/api/dish-versions/${versionId}/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to }),
    });
    setStatus(res.ok ? "sent" : "error");
  }

  return (
    <div className="mt-4 flex items-center gap-2">
      <input type="email" placeholder="recipient@example.com" value={to} onChange={(e) => setTo(e.target.value)} className="rounded border px-3 py-2" />
      <button onClick={handleSend} disabled={status === "sending"} className="rounded bg-black px-4 py-2 text-white">
        {status === "sending" ? "Sending…" : "Email spec sheet"}
      </button>
      {status === "sent" && <span className="text-green-600">Sent.</span>}
      {status === "error" && <span className="text-red-600">Enter a valid email address.</span>}
    </div>
  );
}
```

Add `<EmailShareForm versionId={version.id} />` to `src/app/dishes/[id]/versions/[versionId]/page.tsx` (Task 8), alongside the PDF/Excel/share links.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add email send for dish version spec sheets"
```

---

## Definition of Done

- `npm test` passes with all suites green (foundation + this plan).
- End to end via `npm run dev`: create a dish, build a recipe from the ingredient picker, set a selling price, save — see cost/GP. Amend it, save as v2 — v1's numbers are unchanged. Compare v1 vs v2 and see the ingredient diff. Upload a plated photo. Open the public share link. Download the PDF and Excel spec sheets. Email the spec sheet to a test address and confirm the malformed-address case is rejected in the UI.
