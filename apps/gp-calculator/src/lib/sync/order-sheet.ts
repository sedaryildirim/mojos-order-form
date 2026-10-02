import { prisma } from "@/lib/db/prisma";
import { syncBatchesForIngredients } from "@/lib/costing/batch";
import { previewPriceChanges, PreviewDish, PriceChangeInput } from "@/lib/costing/preview";
import { recordPriceHistory } from "@/lib/costing/price-history";
import { recalculateDishVersionsForIngredients, RecalcSummary } from "@/lib/costing/recalc";
import { SheetRow, SYNCED_SUPPLIERS } from "./order-sheet-rows";

interface SyncReport {
  applied: boolean;
  created: { name: string; supplier: string }[];
  priceChanged: { name: string; supplier: string; oldPrice: number; newPrice: number }[];
  unchanged: number;
  removed: { name: string; supplier: string }[];
  archivedBecauseUsed: { name: string; supplier: string }[];
  // New items whose pack size could not be read from the name (imported as 1 EACH until it is added to order-sheet-packs.json).
  needsPackSize: { name: string; supplier: string }[];
  // Existing ingredients sold in a different unit on the sheet (for example grams in the GP, millilitres on the sheet):
  // linked to the sheet item but left exactly as they were, for the owner to check.
  packMismatch: { name: string; supplier: string; gpPack: string; sheetPack: string; sheetPrice: number }[];
  // Dry run: the dishes that would be recosted. Applied: the dishes that were.
  dishes: PreviewDish[] | RecalcSummary[];
  // Applied only: dishes and batches that use a changed price but could not be recosted (a recipe line's unit no
  // longer fits its ingredient). They keep their old cost until someone fixes the line.
  notRecosted: string[];
}

// Grams and millilitres are treated alike (the GP already stores liquids such as yoghurt and juice in grams).
function unitsCompatible(a: string, b: string): boolean {
  const weightOrVolume = (u: string) => u === "G" || u === "ML";
  return a === b || (weightOrVolume(a) && weightOrVolume(b));
}

// Brings the GP's ingredients in line with the order sheet. `apply: false` only reports what would change.
// Prices that change flow on to batch recipes and dishes (new "Updated" versions), exactly like an import does.
export async function syncOrderSheet(rows: SheetRow[], opts: { apply: boolean; actor: string }): Promise<SyncReport> {
  const { apply, actor } = opts;
  // A bad or empty download must never look like "every item was removed from the sheet".
  if (rows.length === 0) throw new Error("The order sheet has no items to sync. Nothing was changed.");
  const report: SyncReport = { applied: apply, created: [], priceChanged: [], unchanged: 0, removed: [], archivedBecauseUsed: [], needsPackSize: [], packMismatch: [], dishes: [], notRecosted: [] };
  const changedIds: string[] = [];
  const previewChanges = new Map<string, PriceChangeInput>();

  for (const row of rows) {
    let supplier = await prisma.supplier.findFirst({ where: { name: row.supplier } });
    if (!supplier && apply) supplier = await prisma.supplier.create({ data: { name: row.supplier, createdBy: actor, updatedBy: actor } });

    // Matched by the order-sheet key first (so a rename updates in place), else adopted by name and supplier.
    const existing =
      (await prisma.ingredient.findUnique({ where: { sourceKey: row.sourceKey } })) ??
      (supplier ? await prisma.ingredient.findFirst({ where: { name: row.name, supplierId: supplier.id, sourceKey: null } }) : null);

    if (!existing) {
      report.created.push({ name: row.name, supplier: row.supplier });
      if (row.needsPackSize) report.needsPackSize.push({ name: row.name, supplier: row.supplier });
      if (apply) {
        const made = await prisma.ingredient.create({
          data: {
            name: row.name, category: row.category, supplierId: supplier!.id, purchaseUnit: row.purchaseUnit,
            packQuantity: row.packQuantity, packPrice: row.packPrice, sourceKey: row.sourceKey, createdBy: actor, updatedBy: actor,
          },
        });
        await recordPriceHistory(made.id, actor);
      }
      continue;
    }

    // The GP's own pack definition stays (recipes are costed against it). Only the price moves, scaled to that pack.
    if (!unitsCompatible(existing.purchaseUnit, row.purchaseUnit)) {
      report.packMismatch.push({
        name: row.name, supplier: row.supplier, gpPack: `${Number(existing.packQuantity)} ${existing.purchaseUnit}`,
        sheetPack: `${row.packQuantity} ${row.purchaseUnit}`, sheetPrice: row.packPrice,
      });
      if (apply && existing.sourceKey !== row.sourceKey) {
        await prisma.ingredient.update({ where: { id: existing.id }, data: { sourceKey: row.sourceKey, updatedBy: actor } });
      }
      continue;
    }
    const gpQuantity = Number(existing.packQuantity);
    const newPrice = Math.round(((row.packPrice * gpQuantity) / row.packQuantity) * 100) / 100;
    const priceChanged = Number(existing.packPrice) !== newPrice;
    const supplierChanged = !!supplier && existing.supplierId !== supplier.id;
    const needsWrite =
      priceChanged || supplierChanged || existing.sourceKey !== row.sourceKey || existing.name !== row.name || existing.category !== row.category || existing.archived || existing.priceEstimated;

    if (!needsWrite) {
      report.unchanged++;
      continue;
    }
    if (priceChanged) {
      report.priceChanged.push({ name: row.name, supplier: row.supplier, oldPrice: Number(existing.packPrice), newPrice });
      previewChanges.set(existing.id, { packPrice: newPrice });
    } else {
      report.unchanged++;
    }
    if (apply) {
      await prisma.ingredient.update({
        where: { id: existing.id },
        data: {
          name: row.name, category: row.category, supplierId: supplier!.id, packPrice: newPrice,
          sourceKey: row.sourceKey, archived: false, priceEstimated: false, updatedBy: actor,
        },
      });
      if (priceChanged || supplierChanged) await recordPriceHistory(existing.id, actor);
      if (priceChanged) changedIds.push(existing.id);
    }
  }

  // Items that were synced before but are no longer on the sheet. Batch outputs belong to their batch, so they stay.
  const keys = new Set(rows.map((r) => r.sourceKey));
  const managed = await prisma.ingredient.findMany({
    where: { OR: Object.keys(SYNCED_SUPPLIERS).map((id) => ({ sourceKey: { startsWith: `${id}:` } })) },
    include: { supplier: true, _count: { select: { versionLines: true, batchLines: true } }, batchOutput: { select: { id: true } } },
  });
  for (const ing of managed) {
    if (keys.has(ing.sourceKey!) || ing.batchOutput) continue;
    const entry = { name: ing.name, supplier: ing.supplier.name };
    if (ing._count.versionLines + ing._count.batchLines > 0) {
      // A recipe still uses it: deleting would break the recipe, so it is archived and listed instead.
      report.archivedBecauseUsed.push(entry);
      if (apply && !ing.archived) await prisma.ingredient.update({ where: { id: ing.id }, data: { archived: true, updatedBy: actor } });
    } else {
      report.removed.push(entry);
      if (apply) {
        await prisma.$transaction([
          prisma.ingredientPriceHistory.deleteMany({ where: { ingredientId: ing.id } }),
          prisma.ingredient.delete({ where: { id: ing.id } }),
        ]);
      }
    }
  }

  if (apply) {
    const outputs = await syncBatchesForIngredients(changedIds, actor, report.notRecosted);
    report.dishes = await recalculateDishVersionsForIngredients([...changedIds, ...outputs], actor, report.notRecosted);
  } else {
    report.dishes = await previewPriceChanges(previewChanges);
  }
  return report;
}
