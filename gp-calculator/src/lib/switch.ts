import { prisma } from "./prisma";
import { lineCost } from "./costing";
import { comparableName } from "./ingredient-compare";
import { syncBatchesForIngredients } from "./batch";
import { recalculateDishVersionsForIngredients, RecalcSummary } from "./recalc";

export interface CheaperAlternative {
  id: string;
  name: string;
  supplier: string;
  pctCheaper: number;
}

const unitPrice = (i: { packPrice: unknown; packQuantity: unknown; yieldPct: unknown }) =>
  Number(i.packPrice) / Number(i.packQuantity) / (Number(i.yieldPct) / 100);

// The cheapest same-named item (same purchase unit) from another supplier with a real price,
// if it is at least 5% cheaper than this one.
export async function findCheaperAlternative(ingredientId: string): Promise<CheaperAlternative | null> {
  const me = await prisma.ingredient.findUnique({ where: { id: ingredientId } });
  if (!me) return null;
  const key = comparableName(me.name);
  const candidates = await prisma.ingredient.findMany({
    where: { archived: false, priceEstimated: false, purchaseUnit: me.purchaseUnit, supplierId: { not: me.supplierId }, supplier: { name: { not: "House-Made" } } },
    include: { supplier: { select: { name: true } } },
  });
  const best = candidates
    .filter((c) => comparableName(c.name) === key)
    .sort((a, b) => unitPrice(a) - unitPrice(b))[0];
  if (!best || unitPrice(best) >= unitPrice(me) * 0.95) return null;
  return { id: best.id, name: best.name, supplier: best.supplier.name, pctCheaper: Math.round((1 - unitPrice(best) / unitPrice(me)) * 100) };
}

export interface SwitchResult {
  dishesSwitched: number;
  batchesSwitched: number;
  recalculated: RecalcSummary[];
}

// Points every recipe that uses `fromId` at `toId` instead (same quantities and units).
// Batch recipes are edited in place; dishes get a new "Updated" version so history stays intact.
export async function switchIngredient(fromId: string, toId: string, actor: string): Promise<SwitchResult> {
  if (fromId === toId) throw new Error("Choose a different ingredient to switch to");
  const [from, to] = await Promise.all([
    prisma.ingredient.findUnique({ where: { id: fromId } }),
    prisma.ingredient.findUnique({ where: { id: toId } }),
  ]);
  if (!from || !to) throw new Error("Ingredient not found");
  if (from.purchaseUnit !== to.purchaseUnit) throw new Error("The two ingredients are sold in different units, so recipes can't switch automatically");

  const batchLines = await prisma.batchRecipeLine.updateMany({ where: { ingredientId: fromId }, data: { ingredientId: toId } });
  const batchesSwitched = batchLines.count;
  const changedOutputs = await syncBatchesForIngredients([toId], actor);

  const dishes = await prisma.dish.findMany({
    include: { versions: { orderBy: { versionNumber: "desc" }, take: 1, include: { lines: true } } },
  });
  let dishesSwitched = 0;
  for (const d of dishes) {
    const v = d.versions[0];
    if (!v || !v.lines.some((l) => l.ingredientId === fromId)) continue;
    const others = await prisma.ingredient.findMany({ where: { id: { in: v.lines.map((l) => l.ingredientId) } } });
    const byId = new Map(others.map((i) => [i.id, i]));
    byId.set(toId, to);
    const lines = v.lines.map((l) => {
      const ing = byId.get(l.ingredientId === fromId ? toId : l.ingredientId)!;
      const cost = lineCost(
        { purchaseUnit: ing.purchaseUnit, packQuantity: Number(ing.packQuantity), packPrice: Number(ing.packPrice), yieldPct: Number(ing.yieldPct) },
        Number(l.quantity),
        l.unit
      );
      return { ingredientId: ing.id, ingredientNameSnapshot: ing.name, quantity: Number(l.quantity), unit: l.unit, lineCostSnapshot: cost };
    });
    await prisma.dishVersion.create({
      data: {
        dishId: d.id, versionNumber: v.versionNumber + 1, costSnapshot: lines.reduce((s, l) => s + l.lineCostSnapshot, 0),
        sellingPrice: v.sellingPrice, targetGpPct: v.targetGpPct, notes: v.notes, photoUrl: v.photoUrl,
        source: "AUTO_PRICE_REFRESH", createdBy: actor, lines: { create: lines },
      },
    });
    dishesSwitched++;
  }
  const recalculated = await recalculateDishVersionsForIngredients(changedOutputs, actor);
  return { dishesSwitched, batchesSwitched, recalculated };
}
