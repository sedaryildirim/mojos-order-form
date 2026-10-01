# GP Calculator — Foundation & Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Next.js/Postgres project, the pure costing/unit-conversion math, and a working Supplier + Ingredient catalog (CRUD + bulk import) — a complete, independently useful and testable slice of the GP Calculator.

**Architecture:** Next.js (App Router, TypeScript) app with Prisma/Postgres for persistence, API routes under `app/api/*`, and plain React pages for CRUD screens. Money math lives in framework-free `lib/` modules (unit conversion, per-ingredient cost) so it can be unit-tested without a database or browser. This plan implements Suppliers and Ingredients only — Dish/DishVersion/VersionIngredient and everything built on them (dish builder, versioning, sharing) is a separate plan, `2026-09-29-dish-costing.md`, that extends this schema and reuses these `lib/` modules.

**Tech Stack:** Next.js 14 (App Router) + TypeScript, Tailwind CSS, Prisma + PostgreSQL (local dev via Docker Compose; production via Neon/Supabase per spec), Vitest + @testing-library/react for tests, zod for input validation, `xlsx` (SheetJS) for import parsing.

**Spec:** `docs/superpowers/specs/2026-09-29-gp-calculator-design.md`

## Global Constraints

- All money values are Thai Baht (฿); format via `lib/currency.ts formatTHB()` everywhere a price/cost is displayed (spec §3).
- Ingredient purchase pricing is normalized to a **base unit** — `G` (grams), `ML` (millilitres), or `EACH` — rather than the spec's looser "kg/g/L/ml/case/each" list, to remove the case/kg ambiguity: `packQuantity` is always expressed in the ingredient's base unit (e.g. a 5kg bag → `baseUnit=G, packQuantity=5000`; a case of 24 eggs → `baseUnit=EACH, packQuantity=24`), and `packPrice` is the price in ฿ for that whole pack (spec §4/§5). Recipe-line units may be the base unit or its "large" counterpart (`G`↔`KG`, `ML`↔`L`); `EACH` has no large counterpart.
- Yield % (spec §4) defaults to 100 and must be in `(0, 100]` — 0 or negative yield is nonsensical (implies infinite raw quantity needed) and must be rejected by validation.
- Suppliers and Ingredients are **soft-deleted**: an `archived: Boolean` flag, never a real `DELETE` (spec §4, confirmed by owner). Archived records are excluded from default list views and from any "pick an ingredient" UI, but remain fetchable by id so historical data (built in the next plan) keeps working.
- Every Supplier/Ingredient row has `createdAt`, `createdBy` (free text), `updatedAt`, `updatedBy` (free text) — no login, so these are plain text inputs captured on every create/edit (spec §2).

## Review Focus

- Negative or zero price/quantity/pack values on the ingredient or supplier form — must be rejected by validation, not silently stored and later produce a negative or zero cost.
- Two ingredients imported with the same name + supplier in one CSV/XLSX (e.g. a price correction row appended below the original) — the second row must update the same record, not create a duplicate.
- Archiving a supplier that still has non-archived ingredients pointing at it — those ingredients must remain fully functional (still readable, still editable), only the supplier itself disappears from active pickers.
- A recipe-line unit that doesn't share a family with the ingredient's base unit (e.g. asking to convert `EACH` into `G`) — `convert()` must throw a clear error rather than return a silently wrong number.
- An imported spreadsheet row missing a required column (e.g. no price) — that row must be reported as a skipped/failed row, not imported with an implicit zero cost.

---

## File Structure

```
gp-calculator/
  docker-compose.yml              # local Postgres for dev + test
  .env.example
  package.json
  tsconfig.json
  tailwind.config.ts
  next.config.js
  vitest.config.ts
  prisma/
    schema.prisma
  src/
    app/
      layout.tsx
      page.tsx                    # simple home/dashboard shell
      suppliers/
        page.tsx                  # list
        new/page.tsx
        [id]/page.tsx             # edit
      ingredients/
        page.tsx                  # list, filterable by supplier/category
        new/page.tsx
        [id]/page.tsx             # edit
        import/page.tsx           # upload + column mapping
      api/
        suppliers/route.ts
        suppliers/[id]/route.ts
        ingredients/route.ts
        ingredients/[id]/route.ts
        ingredients/import/route.ts
    lib/
      prisma.ts                   # Prisma client singleton
      currency.ts                 # formatTHB()
      units.ts                    # convert(), unit family logic
      costing.ts                  # unitCost(), lineCost()
      validation.ts               # zod schemas shared by API + forms
    components/
      SupplierForm.tsx
      IngredientForm.tsx
```

---

### Task 1: Project scaffold, local Postgres, base layout

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.js`, `tailwind.config.ts`, `postcss.config.js`, `vitest.config.ts`
- Create: `docker-compose.yml`, `.env.example`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`
- Create: `src/app/globals.css`
- Test: `src/app/page.test.tsx`

**Interfaces:**
- Produces: a running Next.js dev server at `http://localhost:3000`; a local Postgres reachable at the `DATABASE_URL` in `.env` for all later tasks.

- [ ] **Step 1: Scaffold the Next.js app**

```bash
npx create-next-app@14 . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

Answer "No" to any prompt about overwriting this directory's existing `docs/` folder if asked; keep it.

- [ ] **Step 2: Add test tooling**

```bash
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom
```

Create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

Create `vitest.setup.ts`:

```typescript
import "@testing-library/jest-dom/vitest";
```

Add to `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 3: Add local Postgres via Docker Compose**

Create `docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: gp
      POSTGRES_PASSWORD: gp
      POSTGRES_DB: gp_calculator
    ports:
      - "5433:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
```

Create `.env.example`:

```
DATABASE_URL="postgresql://gp:gp@localhost:5433/gp_calculator"
```

Run: `cp .env.example .env && docker compose up -d`
Expected: `docker compose ps` shows the `postgres` service as `running`.

- [ ] **Step 4: Minimal home page + test**

`src/app/page.tsx`:

```tsx
export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold">GP Calculator</h1>
      <p className="mt-2 text-gray-600">Suppliers, ingredients, and dish costing.</p>
    </main>
  );
}
```

`src/app/page.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import HomePage from "./page";

test("renders the app title", () => {
  render(<HomePage />);
  expect(screen.getByText("GP Calculator")).toBeInTheDocument();
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test`
Expected: PASS (1 test)

- [ ] **Step 6: Verify dev server runs**

Run: `npm run dev` (then Ctrl+C once you've seen it load at `http://localhost:3000`)
Expected: page loads showing "GP Calculator"

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app, Tailwind, Vitest, local Postgres"
```

---

### Task 2: Prisma schema (Supplier, Ingredient) + client singleton

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/prisma.ts`
- Test: `src/lib/prisma.test.ts`

**Interfaces:**
- Consumes: `DATABASE_URL` from `.env` (Task 1).
- Produces: `prisma` (default export from `src/lib/prisma.ts`, a `PrismaClient` instance) and the `Supplier`/`Ingredient`/`PurchaseUnit` Prisma types, used by every later task that touches the database.

- [ ] **Step 1: Install Prisma**

```bash
npm install prisma @prisma/client
npx prisma init --datasource-provider postgresql
```

(This creates `prisma/schema.prisma` and a `.env` `DATABASE_URL` line — keep the one from Task 1.)

- [ ] **Step 2: Write the schema**

`prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum PurchaseUnit {
  G
  ML
  EACH
}

model Supplier {
  id          String   @id @default(cuid())
  name        String
  contactInfo String?
  archived    Boolean  @default(false)
  createdAt   DateTime @default(now())
  createdBy   String
  updatedAt   DateTime @updatedAt
  updatedBy   String
  ingredients Ingredient[]
}

model Ingredient {
  id            String       @id @default(cuid())
  name          String
  category      String
  supplierId    String
  supplier      Supplier     @relation(fields: [supplierId], references: [id])
  purchaseUnit  PurchaseUnit
  packQuantity  Decimal      @db.Decimal(10, 2)
  packPrice     Decimal      @db.Decimal(10, 2)
  yieldPct      Decimal      @db.Decimal(5, 2) @default(100)
  photoUrl      String?
  archived      Boolean      @default(false)
  createdAt     DateTime     @default(now())
  createdBy     String
  updatedAt     DateTime     @updatedAt
  updatedBy     String

  @@index([supplierId])
}
```

- [ ] **Step 3: Run the migration**

Run: `npx prisma migrate dev --name init`
Expected: migration applies cleanly, Prisma Client generates with no errors.

- [ ] **Step 4: Prisma client singleton**

`src/lib/prisma.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 5: Write the failing test**

`src/lib/prisma.test.ts`:

```typescript
import { prisma } from "./prisma";
import { afterEach, expect, test } from "vitest";

afterEach(async () => {
  await prisma.ingredient.deleteMany();
  await prisma.supplier.deleteMany();
});

test("creates and reads a supplier", async () => {
  const created = await prisma.supplier.create({
    data: { name: "Fresh Farms Co", createdBy: "Sedary", updatedBy: "Sedary" },
  });
  const found = await prisma.supplier.findUnique({ where: { id: created.id } });
  expect(found?.name).toBe("Fresh Farms Co");
  expect(found?.archived).toBe(false);
});
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test`
Expected: PASS — this confirms the Postgres connection, schema, and client work end-to-end.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add Prisma schema for Supplier and Ingredient"
```

---

### Task 3: Currency formatting

**Files:**
- Create: `src/lib/currency.ts`
- Test: `src/lib/currency.test.ts`

**Interfaces:**
- Produces: `formatTHB(amount: number): string`, used by every UI that displays a price/cost.

- [ ] **Step 1: Write the failing test**

`src/lib/currency.test.ts`:

```typescript
import { formatTHB } from "./currency";
import { expect, test } from "vitest";

test("formats whole numbers with thousands separators and 2 decimals", () => {
  expect(formatTHB(1250)).toBe("฿1,250.00");
});

test("rounds to 2 decimal places", () => {
  expect(formatTHB(99.999)).toBe("฿100.00");
});

test("formats zero", () => {
  expect(formatTHB(0)).toBe("฿0.00");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- currency`
Expected: FAIL with "formatTHB is not defined" or module not found.

- [ ] **Step 3: Implement**

`src/lib/currency.ts`:

```typescript
export function formatTHB(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  return (
    "฿" +
    rounded.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}
```

This formats manually rather than relying on `Intl.NumberFormat`'s `currency: "THB"` mode, whose symbol rendering (`฿` vs `THB`) varies by platform/locale data — manual formatting keeps the output deterministic across environments.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- currency`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add THB currency formatting"
```

---

### Task 4: Unit conversion

**Files:**
- Create: `src/lib/units.ts`
- Test: `src/lib/units.test.ts`

**Interfaces:**
- Produces: `type Unit = "G" | "KG" | "ML" | "L" | "EACH"`, `convert(quantity: number, from: Unit, to: Unit): number`, `unitFamily(unit: Unit): "weight" | "volume" | "count"`.
- Consumes: nothing (pure module).

- [ ] **Step 1: Write the failing tests**

`src/lib/units.test.ts`:

```typescript
import { convert, unitFamily } from "./units";
import { expect, test } from "vitest";

test("converts kg to g", () => {
  expect(convert(2, "KG", "G")).toBe(2000);
});

test("converts g to kg", () => {
  expect(convert(500, "G", "KG")).toBe(0.5);
});

test("converts L to ml", () => {
  expect(convert(1.5, "L", "ML")).toBe(1500);
});

test("same unit passes through unchanged", () => {
  expect(convert(10, "EACH", "EACH")).toBe(10);
});

test("throws converting across unit families", () => {
  expect(() => convert(10, "G", "EACH")).toThrow(/incompatible units/i);
});

test("unitFamily groups weight units together", () => {
  expect(unitFamily("G")).toBe("weight");
  expect(unitFamily("KG")).toBe("weight");
  expect(unitFamily("ML")).toBe("volume");
  expect(unitFamily("EACH")).toBe("count");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- units`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement**

`src/lib/units.ts`:

```typescript
export type Unit = "G" | "KG" | "ML" | "L" | "EACH";

const FAMILY: Record<Unit, "weight" | "volume" | "count"> = {
  G: "weight",
  KG: "weight",
  ML: "volume",
  L: "volume",
  EACH: "count",
};

const TO_BASE: Record<Unit, number> = {
  G: 1,
  KG: 1000,
  ML: 1,
  L: 1000,
  EACH: 1,
};

export function unitFamily(unit: Unit): "weight" | "volume" | "count" {
  return FAMILY[unit];
}

export function convert(quantity: number, from: Unit, to: Unit): number {
  if (FAMILY[from] !== FAMILY[to]) {
    throw new Error(`Cannot convert incompatible units: ${from} -> ${to}`);
  }
  const inBase = quantity * TO_BASE[from];
  return inBase / TO_BASE[to];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- units`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add unit conversion for weight/volume/count families"
```

---

### Task 5: Ingredient line costing

**Files:**
- Create: `src/lib/costing.ts`
- Test: `src/lib/costing.test.ts`

**Interfaces:**
- Consumes: `convert`, `Unit` from `src/lib/units.ts` (Task 4).
- Produces: `interface IngredientPricing { purchaseUnit: Unit; packQuantity: number; packPrice: number; yieldPct: number }`, `unitCost(pricing: IngredientPricing): number`, `lineCost(pricing: IngredientPricing, quantityUsed: number, usedUnit: Unit): number`. `lineCost` is what the dish-costing plan's version-saving code will call for every recipe line.

- [ ] **Step 1: Write the failing tests**

`src/lib/costing.test.ts`:

```typescript
import { lineCost, unitCost } from "./costing";
import { expect, test } from "vitest";

const onions = { purchaseUnit: "G" as const, packQuantity: 5000, packPrice: 200, yieldPct: 100 };

test("unit cost is pack price divided by pack quantity", () => {
  expect(unitCost(onions)).toBeCloseTo(0.04, 5); // 200 / 5000
});

test("line cost with 100% yield and matching unit", () => {
  expect(lineCost(onions, 250, "G")).toBeCloseTo(10, 5); // 250g * 0.04
});

test("line cost converts recipe unit to purchase unit", () => {
  expect(lineCost(onions, 0.25, "KG")).toBeCloseTo(10, 5); // 0.25kg = 250g
});

test("line cost scales up for yield loss below 100%", () => {
  const trimmedVeg = { ...onions, yieldPct: 80 };
  // needs 250g usable / 0.8 = 312.5g raw, at 0.04/g = 12.5
  expect(lineCost(trimmedVeg, 250, "G")).toBeCloseTo(12.5, 5);
});

test("throws on zero or negative yield", () => {
  expect(() => lineCost({ ...onions, yieldPct: 0 }, 100, "G")).toThrow(/yield/i);
});

test("each-based ingredient costs correctly", () => {
  const eggs = { purchaseUnit: "EACH" as const, packQuantity: 30, packPrice: 150, yieldPct: 100 };
  expect(lineCost(eggs, 3, "EACH")).toBeCloseTo(15, 5); // 3 eggs * (150/30)
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- costing`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement**

`src/lib/costing.ts`:

```typescript
import { convert, Unit } from "./units";

export interface IngredientPricing {
  purchaseUnit: Unit;
  packQuantity: number;
  packPrice: number;
  yieldPct: number;
}

export function unitCost(pricing: IngredientPricing): number {
  return pricing.packPrice / pricing.packQuantity;
}

export function lineCost(
  pricing: IngredientPricing,
  quantityUsed: number,
  usedUnit: Unit
): number {
  if (pricing.yieldPct <= 0) {
    throw new Error("Ingredient yield% must be greater than 0");
  }
  const rawQuantity = convert(quantityUsed, usedUnit, pricing.purchaseUnit);
  const adjustedForYield = rawQuantity / (pricing.yieldPct / 100);
  return adjustedForYield * unitCost(pricing);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- costing`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add ingredient line costing with yield adjustment"
```

---

### Task 6: Shared validation schemas

**Files:**
- Create: `src/lib/validation.ts`
- Test: `src/lib/validation.test.ts`

**Interfaces:**
- Produces: `supplierInputSchema`, `ingredientInputSchema` (zod schemas), used by both the API routes (Task 7, 8) and the form components (Task 9, 10).

- [ ] **Step 1: Install zod**

```bash
npm install zod
```

- [ ] **Step 2: Write the failing tests**

`src/lib/validation.test.ts`:

```typescript
import { ingredientInputSchema, supplierInputSchema } from "./validation";
import { expect, test } from "vitest";

test("supplier schema requires a non-empty name and createdBy", () => {
  const result = supplierInputSchema.safeParse({ name: "", createdBy: "" });
  expect(result.success).toBe(false);
});

test("supplier schema accepts a valid supplier", () => {
  const result = supplierInputSchema.safeParse({
    name: "Fresh Farms Co",
    contactInfo: "081-234-5678",
    createdBy: "Sedary",
  });
  expect(result.success).toBe(true);
});

test("ingredient schema rejects zero or negative packPrice", () => {
  const result = ingredientInputSchema.safeParse({
    name: "Onions",
    category: "Veg",
    supplierId: "abc",
    purchaseUnit: "G",
    packQuantity: 5000,
    packPrice: 0,
    yieldPct: 100,
    createdBy: "Sedary",
  });
  expect(result.success).toBe(false);
});

test("ingredient schema rejects yieldPct outside (0, 100]", () => {
  const base = {
    name: "Onions",
    category: "Veg",
    supplierId: "abc",
    purchaseUnit: "G" as const,
    packQuantity: 5000,
    packPrice: 200,
    createdBy: "Sedary",
  };
  expect(ingredientInputSchema.safeParse({ ...base, yieldPct: 0 }).success).toBe(false);
  expect(ingredientInputSchema.safeParse({ ...base, yieldPct: 101 }).success).toBe(false);
  expect(ingredientInputSchema.safeParse({ ...base, yieldPct: 100 }).success).toBe(true);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- validation`
Expected: FAIL (module not found)

- [ ] **Step 4: Implement**

`src/lib/validation.ts`:

```typescript
import { z } from "zod";

export const supplierInputSchema = z.object({
  name: z.string().min(1, "Name is required"),
  contactInfo: z.string().optional(),
  createdBy: z.string().min(1, "Your name is required"),
});

export const ingredientInputSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  supplierId: z.string().min(1, "Supplier is required"),
  purchaseUnit: z.enum(["G", "ML", "EACH"]),
  packQuantity: z.number().positive("Pack quantity must be greater than 0"),
  packPrice: z.number().positive("Pack price must be greater than 0"),
  yieldPct: z.number().gt(0).lte(100).default(100),
  createdBy: z.string().min(1, "Your name is required"),
});

export type SupplierInput = z.infer<typeof supplierInputSchema>;
export type IngredientInput = z.infer<typeof ingredientInputSchema>;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- validation`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add shared zod validation schemas"
```

---

### Task 7: Supplier API routes

**Files:**
- Create: `src/app/api/suppliers/route.ts`
- Create: `src/app/api/suppliers/[id]/route.ts`
- Test: `src/app/api/suppliers/route.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 2), `supplierInputSchema` (Task 6).
- Produces: `GET /api/suppliers` (list, excludes archived by default via `?includeArchived=true`), `POST /api/suppliers` (create), `PATCH /api/suppliers/:id` (update, including `{archived: true}`), used by the UI in Task 9.

- [ ] **Step 1: Write the failing test**

`src/app/api/suppliers/route.test.ts`:

```typescript
import { prisma } from "@/lib/prisma";
import { afterEach, expect, test } from "vitest";
import { GET, POST } from "./route";
import { NextRequest } from "next/server";

afterEach(async () => {
  await prisma.ingredient.deleteMany();
  await prisma.supplier.deleteMany();
});

test("POST creates a supplier", async () => {
  const req = new NextRequest("http://localhost/api/suppliers", {
    method: "POST",
    body: JSON.stringify({ name: "Fresh Farms Co", createdBy: "Sedary" }),
  });
  const res = await POST(req);
  expect(res.status).toBe(201);
  const body = await res.json();
  expect(body.name).toBe("Fresh Farms Co");
});

test("POST rejects an invalid payload", async () => {
  const req = new NextRequest("http://localhost/api/suppliers", {
    method: "POST",
    body: JSON.stringify({ name: "", createdBy: "" }),
  });
  const res = await POST(req);
  expect(res.status).toBe(400);
});

test("GET excludes archived suppliers by default", async () => {
  const active = await prisma.supplier.create({ data: { name: "Active Co", createdBy: "S", updatedBy: "S" } });
  await prisma.supplier.create({ data: { name: "Archived Co", createdBy: "S", updatedBy: "S", archived: true } });

  const res = await GET(new NextRequest("http://localhost/api/suppliers"));
  const body = await res.json();
  expect(body.map((s: any) => s.id)).toEqual([active.id]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- api/suppliers/route`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement**

`src/app/api/suppliers/route.ts`:

```typescript
import { prisma } from "@/lib/prisma";
import { supplierInputSchema } from "@/lib/validation";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const includeArchived = req.nextUrl.searchParams.get("includeArchived") === "true";
  const suppliers = await prisma.supplier.findMany({
    where: includeArchived ? {} : { archived: false },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(suppliers);
}

export async function POST(req: NextRequest) {
  const json = await req.json();
  const parsed = supplierInputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const supplier = await prisma.supplier.create({
    data: { ...parsed.data, updatedBy: parsed.data.createdBy },
  });
  return NextResponse.json(supplier, { status: 201 });
}
```

`src/app/api/suppliers/[id]/route.ts`:

```typescript
import { prisma } from "@/lib/prisma";
import { supplierInputSchema } from "@/lib/validation";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const patchSchema = supplierInputSchema.partial().extend({
  archived: z.boolean().optional(),
  updatedBy: z.string().min(1),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const json = await req.json();
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const supplier = await prisma.supplier.update({
    where: { id: params.id },
    data: parsed.data,
  });
  return NextResponse.json(supplier);
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supplier = await prisma.supplier.findUnique({ where: { id: params.id } });
  if (!supplier) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(supplier);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- api/suppliers/route`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Supplier API routes with archive-on-delete semantics"
```

---

### Task 8: Ingredient API routes

**Files:**
- Create: `src/app/api/ingredients/route.ts`
- Create: `src/app/api/ingredients/[id]/route.ts`
- Test: `src/app/api/ingredients/route.test.ts`

**Interfaces:**
- Consumes: `prisma`, `ingredientInputSchema`.
- Produces: `GET /api/ingredients` (list, filterable by `?supplierId=` and `?category=`, excludes archived by default), `POST /api/ingredients`, `PATCH /api/ingredients/:id`. Used by the dish-costing plan's ingredient picker as well as this plan's UI.

- [ ] **Step 1: Write the failing test**

`src/app/api/ingredients/route.test.ts`:

```typescript
import { prisma } from "@/lib/prisma";
import { afterEach, expect, test } from "vitest";
import { GET, POST } from "./route";
import { NextRequest } from "next/server";

afterEach(async () => {
  await prisma.ingredient.deleteMany();
  await prisma.supplier.deleteMany();
});

async function makeSupplier() {
  return prisma.supplier.create({ data: { name: "Fresh Farms Co", createdBy: "S", updatedBy: "S" } });
}

test("POST creates an ingredient", async () => {
  const supplier = await makeSupplier();
  const req = new NextRequest("http://localhost/api/ingredients", {
    method: "POST",
    body: JSON.stringify({
      name: "Onions", category: "Veg", supplierId: supplier.id,
      purchaseUnit: "G", packQuantity: 5000, packPrice: 200, yieldPct: 100,
      createdBy: "Sedary",
    }),
  });
  const res = await POST(req);
  expect(res.status).toBe(201);
});

test("GET filters by supplierId and category", async () => {
  const supplier = await makeSupplier();
  await prisma.ingredient.create({
    data: { name: "Onions", category: "Veg", supplierId: supplier.id, purchaseUnit: "G", packQuantity: 5000, packPrice: 200, createdBy: "S", updatedBy: "S" },
  });
  await prisma.ingredient.create({
    data: { name: "Milk", category: "Dairy", supplierId: supplier.id, purchaseUnit: "ML", packQuantity: 1000, packPrice: 45, createdBy: "S", updatedBy: "S" },
  });

  const req = new NextRequest(`http://localhost/api/ingredients?supplierId=${supplier.id}&category=Veg`);
  const res = await GET(req);
  const body = await res.json();
  expect(body).toHaveLength(1);
  expect(body[0].name).toBe("Onions");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- api/ingredients/route`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement**

`src/app/api/ingredients/route.ts`:

```typescript
import { prisma } from "@/lib/prisma";
import { ingredientInputSchema } from "@/lib/validation";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const includeArchived = searchParams.get("includeArchived") === "true";
  const supplierId = searchParams.get("supplierId") ?? undefined;
  const category = searchParams.get("category") ?? undefined;

  const ingredients = await prisma.ingredient.findMany({
    where: {
      ...(includeArchived ? {} : { archived: false }),
      ...(supplierId ? { supplierId } : {}),
      ...(category ? { category } : {}),
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(ingredients);
}

export async function POST(req: NextRequest) {
  const json = await req.json();
  const parsed = ingredientInputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const ingredient = await prisma.ingredient.create({
    data: { ...parsed.data, updatedBy: parsed.data.createdBy },
  });
  return NextResponse.json(ingredient, { status: 201 });
}
```

`src/app/api/ingredients/[id]/route.ts`:

```typescript
import { prisma } from "@/lib/prisma";
import { ingredientInputSchema } from "@/lib/validation";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const patchSchema = ingredientInputSchema.partial().extend({
  archived: z.boolean().optional(),
  updatedBy: z.string().min(1),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const ingredient = await prisma.ingredient.findUnique({ where: { id: params.id } });
  if (!ingredient) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(ingredient);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const json = await req.json();
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const ingredient = await prisma.ingredient.update({ where: { id: params.id }, data: parsed.data });
  return NextResponse.json(ingredient);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- api/ingredients/route`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Ingredient API routes with supplier/category filtering"
```

---

### Task 9: Supplier UI (list + form)

**Files:**
- Create: `src/components/SupplierForm.tsx`
- Create: `src/app/suppliers/page.tsx`
- Create: `src/app/suppliers/new/page.tsx`
- Create: `src/app/suppliers/[id]/page.tsx`
- Test: `src/components/SupplierForm.test.tsx`

**Interfaces:**
- Consumes: `supplierInputSchema` (Task 6), `POST /api/suppliers`, `PATCH /api/suppliers/:id` (Task 7).
- Produces: `<SupplierForm onSubmit={(data) => void} initialValues?={...} />`, reused by both the "new" and "edit" pages.

- [ ] **Step 1: Write the failing test**

`src/components/SupplierForm.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { SupplierForm } from "./SupplierForm";

test("shows a validation error and blocks submit when name is empty", async () => {
  const onSubmit = vi.fn();
  render(<SupplierForm onSubmit={onSubmit} />);

  fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Sedary" } });
  fireEvent.click(screen.getByText("Save supplier"));

  expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
  expect(onSubmit).not.toHaveBeenCalled();
});

test("calls onSubmit with form values when valid", async () => {
  const onSubmit = vi.fn();
  render(<SupplierForm onSubmit={onSubmit} />);

  fireEvent.change(screen.getByLabelText("Supplier name"), { target: { value: "Fresh Farms Co" } });
  fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Sedary" } });
  fireEvent.click(screen.getByText("Save supplier"));

  expect(onSubmit).toHaveBeenCalledWith({
    name: "Fresh Farms Co",
    contactInfo: "",
    createdBy: "Sedary",
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- SupplierForm`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement the form**

`src/components/SupplierForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { supplierInputSchema } from "@/lib/validation";

export interface SupplierFormValues {
  name: string;
  contactInfo: string;
  createdBy: string;
}

export function SupplierForm({
  initialValues,
  onSubmit,
}: {
  initialValues?: SupplierFormValues;
  onSubmit: (values: SupplierFormValues) => void;
}) {
  const [values, setValues] = useState<SupplierFormValues>(
    initialValues ?? { name: "", contactInfo: "", createdBy: "" }
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = supplierInputSchema.safeParse(values);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        fieldErrors[issue.path[0] as string] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4">
      <div>
        <label htmlFor="name">Supplier name</label>
        <input
          id="name"
          className="mt-1 w-full rounded border px-3 py-2"
          value={values.name}
          onChange={(e) => setValues({ ...values, name: e.target.value })}
        />
        {errors.name && <p className="text-sm text-red-600">{errors.name}</p>}
      </div>
      <div>
        <label htmlFor="contactInfo">Contact info</label>
        <input
          id="contactInfo"
          className="mt-1 w-full rounded border px-3 py-2"
          value={values.contactInfo}
          onChange={(e) => setValues({ ...values, contactInfo: e.target.value })}
        />
      </div>
      <div>
        <label htmlFor="createdBy">Your name</label>
        <input
          id="createdBy"
          className="mt-1 w-full rounded border px-3 py-2"
          value={values.createdBy}
          onChange={(e) => setValues({ ...values, createdBy: e.target.value })}
        />
        {errors.createdBy && <p className="text-sm text-red-600">{errors.createdBy}</p>}
      </div>
      <button type="submit" className="rounded bg-black px-4 py-2 text-white">
        Save supplier
      </button>
    </form>
  );
}
```

Note: `<label htmlFor="name">Supplier name</label>` pairs with the input via `id`, which is what makes `screen.getByLabelText("Supplier name")` resolve in the test.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- SupplierForm`
Expected: PASS (2 tests)

- [ ] **Step 5: Wire up the pages**

`src/app/suppliers/new/page.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { SupplierForm, SupplierFormValues } from "@/components/SupplierForm";

export default function NewSupplierPage() {
  const router = useRouter();

  async function handleSubmit(values: SupplierFormValues) {
    const res = await fetch("/api/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (res.ok) router.push("/suppliers");
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-xl font-semibold">New supplier</h1>
      <div className="mt-6">
        <SupplierForm onSubmit={handleSubmit} />
      </div>
    </main>
  );
}
```

`src/app/suppliers/page.tsx`:

```tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function SuppliersPage() {
  const suppliers = await prisma.supplier.findMany({
    where: { archived: false },
    orderBy: { name: "asc" },
  });

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Suppliers</h1>
        <Link href="/suppliers/new" className="rounded bg-black px-4 py-2 text-white">
          New supplier
        </Link>
      </div>
      <ul className="mt-6 divide-y">
        {suppliers.map((s) => (
          <li key={s.id} className="flex items-center justify-between py-3">
            <Link href={`/suppliers/${s.id}`}>{s.name}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

`src/app/suppliers/[id]/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { SupplierForm, SupplierFormValues } from "@/components/SupplierForm";

export default function EditSupplierPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [initialValues, setInitialValues] = useState<SupplierFormValues | null>(null);

  useEffect(() => {
    fetch(`/api/suppliers/${id}`)
      .then((r) => r.json())
      .then((s) => setInitialValues({ name: s.name, contactInfo: s.contactInfo ?? "", createdBy: "" }));
  }, [id]);

  async function handleSubmit(values: SupplierFormValues) {
    await fetch(`/api/suppliers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, updatedBy: values.createdBy }),
    });
    router.push("/suppliers");
  }

  async function handleArchive() {
    await fetch(`/api/suppliers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true, updatedBy: "system" }),
    });
    router.push("/suppliers");
  }

  if (!initialValues) return <main className="mx-auto max-w-3xl p-8">Loading…</main>;

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-xl font-semibold">Edit supplier</h1>
      <div className="mt-6">
        <SupplierForm initialValues={initialValues} onSubmit={handleSubmit} />
        <button onClick={handleArchive} className="mt-4 text-sm text-red-600">
          Archive this supplier
        </button>
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Manual verification**

Run: `npm run dev`, visit `/suppliers`, create a supplier, edit it, archive it, confirm it disappears from the list.
Expected: full round trip works with no console errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add supplier list, create, edit, and archive UI"
```

---

### Task 10: Ingredient UI (list with filters + form)

**Files:**
- Create: `src/components/IngredientForm.tsx`
- Create: `src/app/ingredients/page.tsx`
- Create: `src/app/ingredients/new/page.tsx`
- Create: `src/app/ingredients/[id]/page.tsx`
- Test: `src/components/IngredientForm.test.tsx`

**Interfaces:**
- Consumes: `ingredientInputSchema` (Task 6), Supplier API (Task 7) for the supplier dropdown, Ingredient API (Task 8).
- Produces: `<IngredientForm suppliers={...} onSubmit={...} initialValues?={...} />`.

- [ ] **Step 1: Write the failing test**

`src/components/IngredientForm.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { IngredientForm } from "./IngredientForm";

const suppliers = [{ id: "sup1", name: "Fresh Farms Co" }];

test("blocks submit when packPrice is zero", async () => {
  const onSubmit = vi.fn();
  render(<IngredientForm suppliers={suppliers} onSubmit={onSubmit} />);

  fireEvent.change(screen.getByLabelText("Ingredient name"), { target: { value: "Onions" } });
  fireEvent.change(screen.getByLabelText("Category"), { target: { value: "Veg" } });
  fireEvent.change(screen.getByLabelText("Pack quantity"), { target: { value: "5000" } });
  fireEvent.change(screen.getByLabelText("Pack price (฿)"), { target: { value: "0" } });
  fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Sedary" } });
  fireEvent.click(screen.getByText("Save ingredient"));

  expect(await screen.findByText(/pack price must be greater than 0/i)).toBeInTheDocument();
  expect(onSubmit).not.toHaveBeenCalled();
});

test("submits valid values including defaulted yield", async () => {
  const onSubmit = vi.fn();
  render(<IngredientForm suppliers={suppliers} onSubmit={onSubmit} />);

  fireEvent.change(screen.getByLabelText("Ingredient name"), { target: { value: "Onions" } });
  fireEvent.change(screen.getByLabelText("Category"), { target: { value: "Veg" } });
  fireEvent.change(screen.getByLabelText("Pack quantity"), { target: { value: "5000" } });
  fireEvent.change(screen.getByLabelText("Pack price (฿)"), { target: { value: "200" } });
  fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Sedary" } });
  fireEvent.click(screen.getByText("Save ingredient"));

  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
    name: "Onions", packQuantity: 5000, packPrice: 200, yieldPct: 100,
  }));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- IngredientForm`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement**

`src/components/IngredientForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { ingredientInputSchema } from "@/lib/validation";

export interface IngredientFormValues {
  name: string;
  category: string;
  supplierId: string;
  purchaseUnit: "G" | "ML" | "EACH";
  packQuantity: number;
  packPrice: number;
  yieldPct: number;
  createdBy: string;
}

const emptyValues: IngredientFormValues = {
  name: "", category: "", supplierId: "", purchaseUnit: "G",
  packQuantity: 0, packPrice: 0, yieldPct: 100, createdBy: "",
};

export function IngredientForm({
  suppliers,
  initialValues,
  onSubmit,
}: {
  suppliers: { id: string; name: string }[];
  initialValues?: IngredientFormValues;
  onSubmit: (values: IngredientFormValues) => void;
}) {
  const [values, setValues] = useState<IngredientFormValues>(initialValues ?? emptyValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function set<K extends keyof IngredientFormValues>(key: K, value: IngredientFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = ingredientInputSchema.safeParse(values);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) fieldErrors[issue.path[0] as string] = issue.message;
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4">
      <div>
        <label htmlFor="name">Ingredient name</label>
        <input id="name" className="mt-1 w-full rounded border px-3 py-2"
          value={values.name} onChange={(e) => set("name", e.target.value)} />
        {errors.name && <p className="text-sm text-red-600">{errors.name}</p>}
      </div>
      <div>
        <label htmlFor="category">Category</label>
        <input id="category" className="mt-1 w-full rounded border px-3 py-2"
          value={values.category} onChange={(e) => set("category", e.target.value)} />
        {errors.category && <p className="text-sm text-red-600">{errors.category}</p>}
      </div>
      <div>
        <label htmlFor="supplierId">Supplier</label>
        <select id="supplierId" className="mt-1 w-full rounded border px-3 py-2"
          value={values.supplierId} onChange={(e) => set("supplierId", e.target.value)}>
          <option value="">Select a supplier</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {errors.supplierId && <p className="text-sm text-red-600">{errors.supplierId}</p>}
      </div>
      <div>
        <label htmlFor="purchaseUnit">Purchase unit</label>
        <select id="purchaseUnit" className="mt-1 w-full rounded border px-3 py-2"
          value={values.purchaseUnit} onChange={(e) => set("purchaseUnit", e.target.value as any)}>
          <option value="G">Weight (grams/kg)</option>
          <option value="ML">Volume (ml/litres)</option>
          <option value="EACH">Count (each)</option>
        </select>
      </div>
      <div>
        <label htmlFor="packQuantity">Pack quantity</label>
        <input id="packQuantity" type="number" className="mt-1 w-full rounded border px-3 py-2"
          value={values.packQuantity} onChange={(e) => set("packQuantity", Number(e.target.value))} />
        {errors.packQuantity && <p className="text-sm text-red-600">{errors.packQuantity}</p>}
      </div>
      <div>
        <label htmlFor="packPrice">Pack price (฿)</label>
        <input id="packPrice" type="number" className="mt-1 w-full rounded border px-3 py-2"
          value={values.packPrice} onChange={(e) => set("packPrice", Number(e.target.value))} />
        {errors.packPrice && <p className="text-sm text-red-600">{errors.packPrice}</p>}
      </div>
      <div>
        <label htmlFor="yieldPct">Yield %</label>
        <input id="yieldPct" type="number" className="mt-1 w-full rounded border px-3 py-2"
          value={values.yieldPct} onChange={(e) => set("yieldPct", Number(e.target.value))} />
        {errors.yieldPct && <p className="text-sm text-red-600">{errors.yieldPct}</p>}
      </div>
      <div>
        <label htmlFor="createdBy">Your name</label>
        <input id="createdBy" className="mt-1 w-full rounded border px-3 py-2"
          value={values.createdBy} onChange={(e) => set("createdBy", e.target.value)} />
        {errors.createdBy && <p className="text-sm text-red-600">{errors.createdBy}</p>}
      </div>
      <button type="submit" className="rounded bg-black px-4 py-2 text-white">Save ingredient</button>
    </form>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- IngredientForm`
Expected: PASS (2 tests)

- [ ] **Step 5: Wire up the pages**

`src/app/ingredients/new/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IngredientForm, IngredientFormValues } from "@/components/IngredientForm";

export default function NewIngredientPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetch("/api/suppliers").then((r) => r.json()).then(setSuppliers);
  }, []);

  async function handleSubmit(values: IngredientFormValues) {
    const res = await fetch("/api/ingredients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (res.ok) router.push("/ingredients");
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-xl font-semibold">New ingredient</h1>
      <div className="mt-6">
        <IngredientForm suppliers={suppliers} onSubmit={handleSubmit} />
      </div>
    </main>
  );
}
```

`src/app/ingredients/page.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatTHB } from "@/lib/currency";

interface IngredientRow {
  id: string; name: string; category: string; packPrice: string; packQuantity: string;
  purchaseUnit: string; supplier: { name: string };
}

export default function IngredientsPage() {
  const [ingredients, setIngredients] = useState<IngredientRow[]>([]);
  const [supplierFilter, setSupplierFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (supplierFilter) params.set("supplierId", supplierFilter);
    if (categoryFilter) params.set("category", categoryFilter);
    fetch(`/api/ingredients?${params}`).then((r) => r.json()).then(setIngredients);
  }, [supplierFilter, categoryFilter]);

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Ingredients</h1>
        <Link href="/ingredients/new" className="rounded bg-black px-4 py-2 text-white">
          New ingredient
        </Link>
      </div>
      <ul className="mt-6 divide-y">
        {ingredients.map((i) => (
          <li key={i.id} className="flex items-center justify-between py-3">
            <div>
              <Link href={`/ingredients/${i.id}`}>{i.name}</Link>
              <span className="ml-2 text-sm text-gray-500">{i.category} · {i.supplier.name}</span>
            </div>
            <span>{formatTHB(Number(i.packPrice))}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

`src/app/ingredients/[id]/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { IngredientForm, IngredientFormValues } from "@/components/IngredientForm";

export default function EditIngredientPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [initialValues, setInitialValues] = useState<IngredientFormValues | null>(null);

  useEffect(() => {
    fetch("/api/suppliers").then((r) => r.json()).then(setSuppliers);
    fetch(`/api/ingredients/${id}`).then((r) => r.json()).then((i) =>
      setInitialValues({
        name: i.name,
        category: i.category,
        supplierId: i.supplierId,
        purchaseUnit: i.purchaseUnit,
        packQuantity: Number(i.packQuantity),
        packPrice: Number(i.packPrice),
        yieldPct: Number(i.yieldPct),
        createdBy: "",
      })
    );
  }, [id]);

  async function handleSubmit(values: IngredientFormValues) {
    await fetch(`/api/ingredients/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, updatedBy: values.createdBy }),
    });
    router.push("/ingredients");
  }

  async function handleArchive() {
    await fetch(`/api/ingredients/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true, updatedBy: "system" }),
    });
    router.push("/ingredients");
  }

  if (!initialValues || suppliers.length === 0) {
    return <main className="mx-auto max-w-3xl p-8">Loading…</main>;
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-xl font-semibold">Edit ingredient</h1>
      <div className="mt-6">
        <IngredientForm suppliers={suppliers} initialValues={initialValues} onSubmit={handleSubmit} />
        <button onClick={handleArchive} className="mt-4 text-sm text-red-600">
          Archive this ingredient
        </button>
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Manual verification**

Run: `npm run dev`, visit `/ingredients`, create an ingredient against a supplier, filter by that supplier and category, edit it, archive it.
Expected: filters narrow the list correctly; archived ingredient disappears.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add ingredient list with filters, create, and edit UI"
```

---

### Task 11: CSV/XLSX import

**Files:**
- Create: `src/lib/import.ts`
- Create: `src/app/api/ingredients/import/route.ts`
- Create: `src/components/ImportMappingForm.tsx`
- Create: `src/app/ingredients/import/page.tsx`
- Test: `src/lib/import.test.ts`
- Test fixture: `src/lib/fixtures/sample-import.csv`

**Interfaces:**
- Consumes: `prisma`, `ingredientInputSchema`.
- Produces: `parseImportRows(fileBuffer: Buffer, filename: string): RawRow[]`, `importIngredients(rows: RawRow[], defaultCreatedBy: string): Promise<ImportResult>` where `ImportResult = { created: number; updated: number; skipped: { row: number; reason: string }[] }`.

- [ ] **Step 1: Install xlsx and add a fixture**

```bash
npm install xlsx
```

`src/lib/fixtures/sample-import.csv`:

```csv
name,category,supplier,purchaseUnit,packQuantity,packPrice,yieldPct
Onions,Veg,Fresh Farms Co,G,5000,200,100
Milk,Dairy,Fresh Farms Co,ML,1000,45,100
Broken Row,Veg,Fresh Farms Co,G,5000,,100
```

- [ ] **Step 2: Write the failing tests**

`src/lib/import.test.ts`:

```typescript
import { readFileSync } from "fs";
import path from "path";
import { afterEach, expect, test } from "vitest";
import { parseImportRows, importIngredients } from "./import";
import { prisma } from "./prisma";

afterEach(async () => {
  await prisma.ingredient.deleteMany();
  await prisma.supplier.deleteMany();
});

const fixturePath = path.join(__dirname, "fixtures/sample-import.csv");

test("parseImportRows reads a CSV into row objects", () => {
  const rows = parseImportRows(readFileSync(fixturePath), "sample-import.csv");
  expect(rows).toHaveLength(3);
  expect(rows[0]).toMatchObject({ name: "Onions", packPrice: "200" });
});

test("importIngredients creates suppliers and ingredients, skipping invalid rows", async () => {
  const rows = parseImportRows(readFileSync(fixturePath), "sample-import.csv");
  const result = await importIngredients(rows, "Sedary");

  expect(result.created).toBe(2);
  expect(result.skipped).toEqual([{ row: 3, reason: expect.stringMatching(/price/i) }]);

  const ingredients = await prisma.ingredient.findMany();
  expect(ingredients.map((i) => i.name).sort()).toEqual(["Milk", "Onions"]);
});

test("importIngredients updates an existing ingredient matched by name+supplier instead of duplicating", async () => {
  const rows = parseImportRows(readFileSync(fixturePath), "sample-import.csv");
  await importIngredients(rows, "Sedary");

  const priceUpdateRows = [{ name: "Onions", category: "Veg", supplier: "Fresh Farms Co", purchaseUnit: "G", packQuantity: "5000", packPrice: "220", yieldPct: "100" }];
  const result = await importIngredients(priceUpdateRows, "Sedary");

  expect(result.created).toBe(0);
  expect(result.updated).toBe(1);
  const onions = await prisma.ingredient.findMany({ where: { name: "Onions" } });
  expect(onions).toHaveLength(1);
  expect(Number(onions[0].packPrice)).toBe(220);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- import`
Expected: FAIL (module not found)

- [ ] **Step 4: Implement**

`src/lib/import.ts`:

```typescript
import * as XLSX from "xlsx";
import { prisma } from "./prisma";

export interface RawRow {
  name: string;
  category: string;
  supplier: string;
  purchaseUnit: string;
  packQuantity: string;
  packPrice: string;
  yieldPct: string;
}

export interface ImportResult {
  created: number;
  updated: number;
  skipped: { row: number; reason: string }[];
}

export function parseImportRows(fileBuffer: Buffer, filename: string): RawRow[] {
  const workbook = XLSX.read(fileBuffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: "" });
}

export async function importIngredients(rows: RawRow[], defaultCreatedBy: string): Promise<ImportResult> {
  const result: ImportResult = { created: 0, updated: 0, skipped: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 1;

    if (!row.name || !row.supplier || !row.packPrice || Number(row.packPrice) <= 0) {
      result.skipped.push({ row: rowNumber, reason: `Missing or invalid price for "${row.name || "unnamed row"}"` });
      continue;
    }
    if (!["G", "ML", "EACH"].includes(row.purchaseUnit)) {
      result.skipped.push({ row: rowNumber, reason: `Unknown purchase unit "${row.purchaseUnit}"` });
      continue;
    }

    let supplier = await prisma.supplier.findFirst({ where: { name: row.supplier } });
    if (!supplier) {
      supplier = await prisma.supplier.create({
        data: { name: row.supplier, createdBy: defaultCreatedBy, updatedBy: defaultCreatedBy },
      });
    }

    const existingIngredient = await prisma.ingredient.findFirst({
      where: { name: row.name, supplierId: supplier.id },
    });

    const data = {
      name: row.name,
      category: row.category || "Uncategorized",
      supplierId: supplier.id,
      purchaseUnit: row.purchaseUnit as "G" | "ML" | "EACH",
      packQuantity: Number(row.packQuantity),
      packPrice: Number(row.packPrice),
      yieldPct: row.yieldPct ? Number(row.yieldPct) : 100,
      updatedBy: defaultCreatedBy,
    };

    if (existingIngredient) {
      await prisma.ingredient.update({ where: { id: existingIngredient.id }, data });
      result.updated++;
    } else {
      await prisma.ingredient.create({ data: { ...data, createdBy: defaultCreatedBy } });
      result.created++;
    }
  }

  return result;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- import`
Expected: PASS (3 tests)

- [ ] **Step 6: API route**

`src/app/api/ingredients/import/route.ts`:

```typescript
import { importIngredients, parseImportRows } from "@/lib/import";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const createdBy = formData.get("createdBy") as string | null;

  if (!file || !createdBy) {
    return NextResponse.json({ error: "file and createdBy are required" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const rows = parseImportRows(buffer, file.name);
  const result = await importIngredients(rows, createdBy);
  return NextResponse.json(result);
}
```

- [ ] **Step 7: Import page**

`src/app/ingredients/import/page.tsx`:

```tsx
"use client";

import { useState } from "react";

export default function ImportIngredientsPage() {
  const [createdBy, setCreatedBy] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<{ created: number; updated: number; skipped: { row: number; reason: string }[] } | null>(null);

  async function handleImport() {
    if (!file || !createdBy) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("createdBy", createdBy);
    const res = await fetch("/api/ingredients/import", { method: "POST", body: formData });
    setResult(await res.json());
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-xl font-semibold">Import suppliers &amp; ingredients</h1>
      <p className="mt-2 text-sm text-gray-600">
        Expected columns: name, category, supplier, purchaseUnit (G/ML/EACH), packQuantity, packPrice, yieldPct.
      </p>
      <div className="mt-6 space-y-4 max-w-md">
        <input placeholder="Your name" className="w-full rounded border px-3 py-2"
          value={createdBy} onChange={(e) => setCreatedBy(e.target.value)} />
        <input type="file" accept=".csv,.xlsx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <button onClick={handleImport} className="rounded bg-black px-4 py-2 text-white">
          Import
        </button>
      </div>
      {result && (
        <div className="mt-6">
          <p>{result.created} created, {result.updated} updated, {result.skipped.length} skipped.</p>
          {result.skipped.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-sm text-red-600">
              {result.skipped.map((s) => <li key={s.row}>Row {s.row}: {s.reason}</li>)}
            </ul>
          )}
        </div>
      )}
    </main>
  );
}
```

(`ImportMappingForm.tsx` is intentionally not built as a separate column-mapping UI in this pass — the fixed-column CSV/XLSX template above with clear on-page instructions covers the "both — import to start, manual entry after" requirement without adding a drag-and-drop column mapper. Skip creating that file.)

- [ ] **Step 8: Manual verification**

Run: `npm run dev`, visit `/ingredients/import`, upload `src/lib/fixtures/sample-import.csv`, confirm it reports "2 created, 0 updated, 1 skipped" and the skipped-row reason is shown.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add CSV/XLSX import for suppliers and ingredients"
```

---

## Definition of Done

- `npm test` passes with all suites green.
- `npm run dev` lets you: create/edit/archive a supplier; create/edit/archive an ingredient with unit/pack/yield fields; filter ingredients by supplier and category; import the sample CSV and see a created/updated/skipped report.
- Every Supplier/Ingredient row in the database has `createdBy`/`updatedBy`/timestamps populated.
