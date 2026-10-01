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

// Regression test: a version with targetGpPct set and no sellingPrice must
// still include a suggested-price row, matching the identical computation
// SpecSheet.tsx and DishVersionForm.tsx already perform for this case.
// buildSpecSheetWorkbook previously never called suggestedPriceFromTargetGp
// at all, so this row was always omitted for that case.
test("includes a suggested price row for a target-GP-only version (no selling price)", () => {
  const targetGpOnlyVersion = { ...version, sellingPrice: null, targetGpPct: "70" };
  const buffer = buildSpecSheetWorkbook(targetGpOnlyVersion as any);
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<any>(sheet, { header: 1 });

  const flat = rows.map((r) => r.join(",")).join("\n");
  expect(flat).toContain("Suggested price for 70% target GP");
});
