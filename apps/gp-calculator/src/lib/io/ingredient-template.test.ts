import * as XLSX from "xlsx";
import { expect, test } from "vitest";
import { buildIngredientTemplateWorkbook } from "./ingredient-template";
import { parseImportRows } from "./import";

test("Ingredients is the first sheet, with the header import.ts expects", () => {
  const buffer = buildIngredientTemplateWorkbook([
    { name: "Onions", category: "Veg", supplier: "Fresh Farms Co", purchaseUnit: "G", packQuantity: 5000, packPrice: 200, yieldPct: 100 },
  ]);
  const workbook = XLSX.read(buffer, { type: "buffer" });

  expect(workbook.SheetNames[0]).toBe("Ingredients");
  expect(workbook.SheetNames).toContain("Instructions");

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
  expect(rows[0]).toEqual(["name", "category", "supplier", "purchaseUnit", "packQuantity", "packPrice", "yieldPct"]);
  expect(rows[1]).toEqual(["Onions", "Veg", "Fresh Farms Co", "G", 5000, 200, 100]);
});

test("round-trips through parseImportRows unchanged", () => {
  const buffer = buildIngredientTemplateWorkbook([
    { name: "Milk", category: "Dairy", supplier: "Fresh Farms Co", purchaseUnit: "ML", packQuantity: 1000, packPrice: 45, yieldPct: 100 },
  ]);
  const rows = parseImportRows(buffer, "template.xlsx");
  expect(rows).toEqual([
    { name: "Milk", category: "Dairy", supplier: "Fresh Farms Co", purchaseUnit: "ML", packQuantity: "1000", packPrice: "45", yieldPct: "100" },
  ]);
});

test("produces just the header row with no data rows when there are no ingredients", () => {
  const buffer = buildIngredientTemplateWorkbook([]);
  const rows = parseImportRows(buffer, "template.xlsx");
  expect(rows).toEqual([]);
});
