import * as XLSX from "xlsx";
import { isPlaceholderSupplier } from "@/lib/costing/estimates";
import { recordPriceHistory } from "@/lib/costing/price-history";
import { prisma } from "@/lib/db/prisma";
import { previewPriceChanges, PreviewDish, PriceChangeInput } from "@/lib/costing/preview";
import { ingredientInputSchema } from "@/lib/db/validation";

const VALID_PURCHASE_UNITS = ingredientInputSchema.shape.purchaseUnit.options;

export interface RawRow {
  name: string;
  category: string;
  supplier: string;
  purchaseUnit: string;
  packQuantity: string;
  packPrice: string;
  yieldPct: string;
}

interface ImportResult {
  created: number;
  updated: number;
  skipped: { row: number; reason: string }[];
  // Ids of existing ingredients whose packPrice/packQuantity/purchaseUnit/yieldPct
  // actually changed value on this import (not just "matched a row") -- the caller
  // uses this to recalculate dish costs, so re-uploading identical prices must not
  // trigger a recalculation.
  priceChangedIngredientIds: string[];
  // Estimated prices that this import confirmed as real: rows for a real supplier that
  // match an estimated ingredient (either already under that supplier, or the same-named
  // estimate under the placeholder supplier, which is moved across so recipes keep working).
  confirmed: number;
}

export function parseImportRows(fileBuffer: Buffer): RawRow[] {
  const workbook = XLSX.read(fileBuffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  // raw: true (the default) returns each cell's underlying value rather than its
  // formatted display text — e.g. a currency-formatted "$200.00" cell yields the
  // raw number 200, not the string "$200.00". We then coerce every field to a
  // string ourselves so the rest of the import logic can treat RawRow uniformly
  // as strings, without depending on SheetJS's locale/format-dependent rendering
  // (which would otherwise risk mis-parsing formatted numeric cells as invalid).
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: true });
  return rawRows.map((row) => {
    const stringRow = {} as RawRow;
    for (const [key, value] of Object.entries(row)) {
      (stringRow as unknown as Record<string, string>)[key] = value === null || value === undefined ? "" : String(value);
    }
    return stringRow;
  });
}

type ParsedRow =
  | { ok: true; name: string; category: string; supplier: string; purchaseUnit: "G" | "ML" | "EACH"; packQuantity: number; packPrice: number; yieldPct: number }
  | { ok: false; reason: string };

// Checks one spreadsheet row. Shared by the real import and the preview so they always agree.
function parseRow(row: RawRow): ParsedRow {
  const label = row.name || "unnamed row";
  if (!row.name) return { ok: false, reason: "Missing ingredient name" };
  if (!row.supplier) return { ok: false, reason: `Missing supplier for "${label}"` };
  if (!VALID_PURCHASE_UNITS.includes(row.purchaseUnit as (typeof VALID_PURCHASE_UNITS)[number])) {
    return { ok: false, reason: `Unknown purchase unit "${row.purchaseUnit}" for "${label}"` };
  }
  const packPrice = Number(row.packPrice);
  if (!Number.isFinite(packPrice) || packPrice <= 0) return { ok: false, reason: `Missing or invalid price for "${label}"` };
  const packQuantity = Number(row.packQuantity);
  if (!Number.isFinite(packQuantity) || packQuantity <= 0) return { ok: false, reason: `Missing or invalid pack quantity for "${label}"` };
  const yieldPct = row.yieldPct ? Number(row.yieldPct) : 100;
  if (!Number.isFinite(yieldPct) || yieldPct <= 0 || yieldPct > 100) return { ok: false, reason: `Yield% must be between 0 and 100 for "${label}"` };
  return {
    ok: true,
    name: row.name,
    category: row.category || "Uncategorized",
    supplier: row.supplier,
    purchaseUnit: row.purchaseUnit as "G" | "ML" | "EACH",
    packQuantity,
    packPrice,
    yieldPct,
  };
}

interface ImportPreview {
  created: number;
  updated: number;
  confirmed: number;
  unchanged: number;
  skipped: { row: number; reason: string }[];
  dishes: PreviewDish[];
}

// What an import WOULD do, without writing anything: counts, skipped rows and which dishes would be recosted.
export async function previewImport(rows: RawRow[]): Promise<ImportPreview> {
  const out: ImportPreview = { created: 0, updated: 0, confirmed: 0, unchanged: 0, skipped: [], dishes: [] };
  const changes = new Map<string, PriceChangeInput>();

  for (let i = 0; i < rows.length; i++) {
    const parsed = parseRow(rows[i]);
    if (!parsed.ok) {
      out.skipped.push({ row: i + 2, reason: parsed.reason });
      continue;
    }
    const supplier = await prisma.supplier.findFirst({ where: { name: parsed.supplier } });
    let existing = supplier ? await prisma.ingredient.findFirst({ where: { name: parsed.name, supplierId: supplier.id } }) : null;
    const realSupplier = !isPlaceholderSupplier(parsed.supplier);
    if (!existing && realSupplier) {
      const estimates = await prisma.ingredient.findMany({
        where: { name: parsed.name, priceEstimated: true, archived: false, supplier: { name: { startsWith: "Placeholder" } } },
      });
      if (estimates.length === 1) existing = estimates[0];
    }
    if (!existing) {
      out.created++;
      continue;
    }
    out.updated++;
    if (realSupplier && existing.priceEstimated) out.confirmed++;
    const pricingChanged =
      Number(existing.packPrice) !== parsed.packPrice ||
      Number(existing.packQuantity) !== parsed.packQuantity ||
      existing.purchaseUnit !== parsed.purchaseUnit ||
      Number(existing.yieldPct) !== parsed.yieldPct;
    if (pricingChanged) changes.set(existing.id, parsed);
    else out.unchanged++;
  }
  out.dishes = await previewPriceChanges(changes);
  return out;
}

export async function importIngredients(rows: RawRow[], defaultCreatedBy: string): Promise<ImportResult> {
  const result: ImportResult = { created: 0, updated: 0, skipped: [], priceChangedIngredientIds: [], confirmed: 0 };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    // Spreadsheet row 1 is the header row, so data row i (0-indexed) is
    // spreadsheet row i + 2.
    const rowNumber = i + 2;
    const label = row.name || "unnamed row";
    const parsed = parseRow(row);
    if (!parsed.ok) {
      result.skipped.push({ row: rowNumber, reason: parsed.reason });
      continue;
    }
    const { packPrice, packQuantity, yieldPct } = parsed;

    try {
      let supplier = await prisma.supplier.findFirst({ where: { name: row.supplier } });
      if (!supplier) {
        supplier = await prisma.supplier.create({
          data: { name: row.supplier, createdBy: defaultCreatedBy, updatedBy: defaultCreatedBy },
        });
      }

      let existingIngredient = await prisma.ingredient.findFirst({
        where: { name: row.name, supplierId: supplier.id },
      });

      // A real supplier on a row whose name matches an estimated placeholder ingredient means
      // "this is the real price": adopt that ingredient instead of creating a duplicate.
      const realSupplier = !isPlaceholderSupplier(supplier.name);
      if (!existingIngredient && realSupplier) {
        const estimates = await prisma.ingredient.findMany({
          where: { name: row.name, priceEstimated: true, archived: false, supplier: { name: { startsWith: "Placeholder" } } },
        });
        if (estimates.length === 1) existingIngredient = estimates[0];
      }

      const data = {
        name: row.name,
        category: row.category || "Uncategorized",
        supplierId: supplier.id,
        purchaseUnit: row.purchaseUnit as "G" | "ML" | "EACH",
        packQuantity,
        packPrice,
        yieldPct,
        updatedBy: defaultCreatedBy,
      };

      if (existingIngredient) {
        const pricingChanged =
          Number(existingIngredient.packPrice) !== packPrice ||
          Number(existingIngredient.packQuantity) !== packQuantity ||
          existingIngredient.purchaseUnit !== row.purchaseUnit ||
          Number(existingIngredient.yieldPct) !== yieldPct;
        const confirms = realSupplier && existingIngredient.priceEstimated;
        await prisma.ingredient.update({
          where: { id: existingIngredient.id },
          data: confirms ? { ...data, priceEstimated: false } : data,
        });
        result.updated++;
        if (confirms) result.confirmed++;
        if (pricingChanged) {
          result.priceChangedIngredientIds.push(existingIngredient.id);
        }
        if (pricingChanged || existingIngredient.supplierId !== supplier.id) {
          await recordPriceHistory(existingIngredient.id, defaultCreatedBy);
        }
      } else {
        const created = await prisma.ingredient.create({
          data: { ...data, priceEstimated: isPlaceholderSupplier(supplier.name), createdBy: defaultCreatedBy },
        });
        await recordPriceHistory(created.id, defaultCreatedBy);
        result.created++;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.skipped.push({ row: rowNumber, reason: `Failed to save "${label}": ${message}` });
    }
  }

  return result;
}
