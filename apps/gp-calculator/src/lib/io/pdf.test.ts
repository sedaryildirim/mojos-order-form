import { renderSpecSheetPdf } from "./pdf";
import { expect, test, vi } from "vitest";
import * as costing from "@/lib/costing/costing";

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

// Regression test: Prisma returns `@db.Decimal` fields (like
// VersionIngredient.quantity) as live Decimal OBJECT instances, not strings,
// when a version is fetched via `prisma.dishVersion.findUnique(...)` and
// passed straight into `renderSpecSheetPdf`. React/@react-pdf/renderer reject
// non-primitive objects as JSX children, so interpolating a raw Decimal
// object directly (e.g. `{line.quantity}`) either throws or silently
// misrenders. This fixture simulates that shape with an object whose
// `toString()` returns the numeric string, the same interface Decimal
// exposes for this function's purposes.
test("renders a non-empty PDF buffer when quantity is a Decimal-like object (not a plain string)", async () => {
  const decimalLikeVersion = {
    ...version,
    lines: [
      {
        id: "l1",
        ingredientNameSnapshot: "Onions",
        quantity: { toString: () => "250.000" } as unknown as string,
        unit: "G",
        lineCostSnapshot: "10.00",
      },
    ],
  };

  const buffer = await renderSpecSheetPdf(decimalLikeVersion as any);
  expect(buffer.length).toBeGreaterThan(0);
  expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
});

// Regression test: a version with targetGpPct set and no sellingPrice must
// still compute a suggested price, matching the identical computation
// SpecSheet.tsx and DishVersionForm.tsx already perform for this case.
// renderSpecSheetPdf previously never called suggestedPriceFromTargetGp at
// all, so this line was always omitted from the PDF for that case.
test("computes a suggested price for a target-GP-only version (no selling price)", async () => {
  const spy = vi.spyOn(costing, "suggestedPriceFromTargetGp");
  const targetGpOnlyVersion = { ...version, sellingPrice: null, targetGpPct: "70" };

  const buffer = await renderSpecSheetPdf(targetGpOnlyVersion as any);

  expect(spy).toHaveBeenCalledWith(10, 70); // cost = Number(costSnapshot) = 10
  expect(buffer.length).toBeGreaterThan(0);
  spy.mockRestore();
});
