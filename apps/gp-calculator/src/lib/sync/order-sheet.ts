import { prisma } from "@/lib/db/prisma";
import { syncBatchesForIngredients } from "@/lib/costing/batch";
import { previewPriceChanges, PreviewDish, PriceChangeInput } from "@/lib/costing/preview";
import { recordPriceHistory } from "@/lib/costing/price-history";
import { recalculateDishVersionsForIngredients, RecalcSummary } from "@/lib/costing/recalc";
import { SheetRow, SYNCED_SUPPLIERS } from "./order-sheet-rows";

export interface SyncReport {
  applied: boolean;
  created: { name: string; supplier: string }[];
  priceChanged: { name: string; supplier: string; oldPrice: number; newPrice: number }[];
  unchanged: number;
  removed: { name: string; supplier: string }[];
  archivedBecauseUsed: { name: string; supplier: string }[];
  needsPackSize: { name: string; supplier: string }[];
  // Dry run: the dishes that would be recosted. Applied: the dishes that were.
  dishes: PreviewDish[] | RecalcSummary[];
}

// Brings the GP's ingredients in line with the order sheet. `apply: false` only reports what would change.
// Prices that change flow on to batch recipes and dishes (new "Updated" versions), exactly like an import does.
export async function syncOrderSheet(rows: SheetRow[], opts: { apply: boolean; actor: string }): Promise<SyncReport> {
  const { apply, actor } = opts;
  const report: SyncReport = { applied: apply, created: [], priceChanged: [], unchanged: 0, removed: [], archivedBecauseUsed: [], needsPackSize: [], dishes: [] };
  const changedIds: string[] = [];
  const previewChanges = new Map<string, PriceChangeInput>();

  for (const row of rows) {
    if (row.needsPackSize) report.needsPackSize.push({ name: row.name, supplier: row.supplier });

    let supplier = await prisma.supplier.findFirst({ where: { name: row.supplier } });
    if (!supplier && apply) supplier = await prisma.supplier.create({ data: { name: row.supplier, createdBy: actor, updatedBy: actor } });

    // Matched by the order-sheet key first (so a rename updates in place), else adopted by name and supplier.
    const existing =
      (await prisma.ingredient.findUnique({ where: { sourceKey: row.sourceKey } })) ??
      (supplier ? await prisma.ingredient.findFirst({ where: { name: row.name, supplierId: supplier.id, sourceKey: null } }) : null);

    if (!existing) {
      report.created.push({ name: row.name, supplier: row.supplier });
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

    const priceChanged =
      Number(existing.packPrice) !== row.packPrice || Number(existing.packQuantity) !== row.packQuantity || existing.purchaseUnit !== row.purchaseUnit;
    const supplierChanged = !!supplier && existing.supplierId !== supplier.id;
    const needsWrite =
      priceChanged || supplierChanged || existing.sourceKey !== row.sourceKey || existing.name !== row.name || existing.category !== row.category || existing.archived || existing.priceEstimated;

    if (!needsWrite) {
      report.unchanged++;
      continue;
    }
    if (priceChanged) {
      report.priceChanged.push({ name: row.name, supplier: row.supplier, oldPrice: Number(existing.packPrice), newPrice: row.packPrice });
      previewChanges.set(existing.id, { purchaseUnit: row.purchaseUnit, packQuantity: row.packQuantity, packPrice: row.packPrice });
    } else {
      report.unchanged++;
    }
    if (apply) {
      await prisma.ingredient.update({
        where: { id: existing.id },
        data: {
          name: row.name, category: row.category, supplierId: supplier!.id, purchaseUnit: row.purchaseUnit, packQuantity: row.packQuantity,
          packPrice: row.packPrice, sourceKey: row.sourceKey, archived: false, priceEstimated: false, updatedBy: actor,
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
    const outputs = await syncBatchesForIngredients(changedIds, actor);
    report.dishes = await recalculateDishVersionsForIngredients([...changedIds, ...outputs], actor);
  } else {
    report.dishes = await previewPriceChanges(previewChanges);
  }
  return report;
}
