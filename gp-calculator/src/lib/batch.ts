import { prisma } from "./prisma";
import { lineCost } from "./costing";
import { batchPortions } from "./batch-math";
import { recordPriceHistory } from "./price-history";

export const HOUSE_MADE_SUPPLIER = "House-Made";

interface CostableLine {
  quantity: unknown;
  unit: "G" | "KG" | "ML" | "L" | "EACH";
  ingredient: { purchaseUnit: "G" | "ML" | "EACH"; packQuantity: unknown; packPrice: unknown; yieldPct: unknown };
}

// Throws if any line's unit family doesn't match its ingredient (lineCost/convert).
export function batchTotalCost(lines: CostableLine[]): number {
  return lines.reduce(
    (sum, l) =>
      sum +
      lineCost(
        {
          purchaseUnit: l.ingredient.purchaseUnit,
          packQuantity: Number(l.ingredient.packQuantity),
          packPrice: Number(l.ingredient.packPrice),
          yieldPct: Number(l.ingredient.yieldPct),
        },
        Number(l.quantity),
        l.unit
      ),
    0
  );
}

async function houseMadeSupplierId(actor: string): Promise<string> {
  const existing = await prisma.supplier.findFirst({ where: { name: HOUSE_MADE_SUPPLIER } });
  if (existing) return existing.id;
  const created = await prisma.supplier.create({
    data: { name: HOUSE_MADE_SUPPLIER, createdBy: actor, updatedBy: actor },
  });
  return created.id;
}

// Publishes the batch as an ingredient (pack = the whole batch) so dishes can use
// it through the normal ingredient flow. A batch with no ingredient lines is a
// draft shell: it never touches its linked ingredient's price.
// Returns the output ingredient id if its price/pack changed, otherwise null.
export async function syncBatchOutput(batchId: string, actor: string): Promise<string | null> {
  const batch = await prisma.batchRecipe.findUnique({
    where: { id: batchId },
    include: { lines: { include: { ingredient: true } } },
  });
  if (!batch || batch.lines.length === 0) return null;

  const totalCost = batchTotalCost(batch.lines);
  if (!(totalCost > 0)) return null;

  const supplierId = await houseMadeSupplierId(actor);
  const yieldQuantity = Number(batch.yieldQuantity);

  if (!batch.outputIngredientId) {
    const created = await prisma.ingredient.create({
      data: {
        name: batch.name,
        category: batch.category,
        supplierId,
        purchaseUnit: batch.yieldUnit,
        packQuantity: yieldQuantity,
        packPrice: totalCost,
        yieldPct: 100,
        createdBy: actor,
        updatedBy: actor,
      },
    });
    await prisma.batchRecipe.update({ where: { id: batch.id }, data: { outputIngredientId: created.id } });
    await recordPriceHistory(created.id, actor);
    return created.id;
  }

  const current = await prisma.ingredient.findUnique({ where: { id: batch.outputIngredientId } });
  if (!current) return null;
  const changed =
    Math.abs(Number(current.packPrice) - totalCost) >= 0.005 ||
    Number(current.packQuantity) !== yieldQuantity ||
    current.purchaseUnit !== batch.yieldUnit;

  await prisma.ingredient.update({
    where: { id: current.id },
    data: {
      name: batch.name,
      category: batch.category,
      supplierId,
      purchaseUnit: batch.yieldUnit,
      packQuantity: yieldQuantity,
      packPrice: totalCost,
      yieldPct: 100,
      // once a batch has real ingredient lines, its price is calculated rather than guessed
      priceEstimated: false,
      updatedBy: actor,
    },
  });
  if (changed) await recordPriceHistory(current.id, actor);
  return changed ? current.id : null;
}

// After ingredient prices change: re-sync every batch that uses one of them (and,
// since a batch can use another batch's output, repeat until nothing new changes).
// Returns the output-ingredient ids whose price changed, so callers can recost dishes.
export async function syncBatchesForIngredients(changedIngredientIds: string[], actor: string): Promise<string[]> {
  const changedOutputs = new Set<string>();
  let frontier = new Set(changedIngredientIds);
  for (let round = 0; round < 5 && frontier.size > 0; round++) {
    const batches = await prisma.batchRecipe.findMany({
      where: { lines: { some: { ingredientId: { in: Array.from(frontier) } } } },
      select: { id: true },
    });
    const next = new Set<string>();
    for (const b of batches) {
      try {
        const out = await syncBatchOutput(b.id, actor);
        if (out) {
          changedOutputs.add(out);
          next.add(out);
        }
      } catch {
        // a batch line whose unit no longer fits its ingredient can't be recosted; leave it as-is
      }
    }
    frontier = next;
  }
  return Array.from(changedOutputs);
}

type BatchWithLines = NonNullable<Awaited<ReturnType<typeof loadBatch>>>;

export async function loadBatch(id: string) {
  return prisma.batchRecipe.findUnique({
    where: { id },
    include: { lines: { include: { ingredient: { include: { supplier: { select: { name: true } } } } } } },
  });
}

// Adds computed cost fields for the UI. costPerUnit is per portion (EACH) or per 100 g / 100 ml.
export function presentBatch(batch: BatchWithLines) {
  let totalCost: number | null = null;
  let costError = false;
  if (batch.lines.length > 0) {
    try {
      totalCost = batchTotalCost(batch.lines);
    } catch {
      costError = true;
    }
  }
  const yieldQuantity = Number(batch.yieldQuantity);
  const perUnitDivisor = batch.yieldUnit === "EACH" ? yieldQuantity : yieldQuantity / 100;
  const costPerUnit = totalCost !== null && perUnitDivisor > 0 ? totalCost / perUnitDivisor : null;
  const portions = batchPortions(yieldQuantity, batch.yieldUnit, batch.portionSize === null ? null : Number(batch.portionSize));
  const costPerPortion = totalCost !== null && portions !== null && portions > 0 ? totalCost / portions : null;
  const sellingPrice = batch.sellingPrice === null ? null : Number(batch.sellingPrice);
  const gpPct = sellingPrice && costPerPortion !== null ? (sellingPrice - costPerPortion) / sellingPrice : null;
  return { ...batch, totalCost, costPerUnit, portions, costPerPortion, gpPct, costError, isDraft: batch.lines.length === 0 };
}
