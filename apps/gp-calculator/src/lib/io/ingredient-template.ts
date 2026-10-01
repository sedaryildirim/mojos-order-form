import * as XLSX from "xlsx";

export interface IngredientTemplateRow {
  name: string;
  category: string;
  supplier: string;
  purchaseUnit: string;
  packQuantity: number;
  packPrice: number;
  yieldPct: number;
}

// Header must exactly match the RawRow field names in ./import.ts -- SheetJS
// derives each imported row's keys from this header row, so if these strings
// drift from import.ts's RawRow interface, a re-uploaded template silently
// fails to round-trip (every field comes back undefined).
const HEADER = ["name", "category", "supplier", "purchaseUnit", "packQuantity", "packPrice", "yieldPct"];

const INSTRUCTIONS: (string | number)[][] = [
  ["How to use this template"],
  [],
  ["This sheet is pre-filled with every active ingredient currently in the system."],
  ["Edit a row's category / purchaseUnit / packQuantity / packPrice / yieldPct and re-upload it on the"],
  ["Import page to update that ingredient's price. Any dish whose recipe uses a changed ingredient"],
  ["gets a new version automatically, with its cost and GP recalculated and marked as updated."],
  [],
  ["To add a brand new ingredient, add a new row. A new supplier name creates that supplier too."],
  [],
  ["To confirm an estimated price: put the real supplier's name in the supplier column of that row (and the"],
  ["real pack size and price). The import moves the estimate to that supplier and marks the price as real."],
  ["Rows left under the placeholder supplier stay marked as estimates."],
  [],
  ["purchaseUnit must be one of: G, ML, EACH"],
  ["packQuantity / packPrice are for a whole pack as bought from the supplier (e.g. a 5kg bag = 5000 G)."],
  ["yieldPct is optional (defaults to 100) -- use it when part of the pack is unusable, e.g. trim/waste."],
  [],
  ["Archived ingredients are not included in this export."],
];

export function buildIngredientTemplateWorkbook(rows: IngredientTemplateRow[]): Buffer {
  const dataRows = rows.map((r) => [r.name, r.category, r.supplier, r.purchaseUnit, r.packQuantity, r.packPrice, r.yieldPct]);
  const ingredientSheet = XLSX.utils.aoa_to_sheet([HEADER, ...dataRows]);

  const workbook = XLSX.utils.book_new();
  // "Ingredients" MUST be the first sheet -- parseImportRows() always reads
  // workbook.SheetNames[0], so a re-uploaded template with sheets in a
  // different order would silently import nothing.
  XLSX.utils.book_append_sheet(workbook, ingredientSheet, "Ingredients");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(INSTRUCTIONS), "Instructions");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}
