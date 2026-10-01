import { prisma } from "./prisma";
import { gpFromSellingPrice, lineCost, IngredientPricing } from "./costing";

export interface PriceChangeInput {
  packQuantity?: number;
  packPrice?: number;
  yieldPct?: number;
  purchaseUnit?: "G" | "ML" | "EACH";
}

export interface PreviewDish {
  dishId: string;
  name: string;
  oldCost: number;
  newCost: number;
  sellingPrice: number | null;
  oldGpPct: number | null;
  newGpPct: number | null;
}

// What would happen to dish costs if this ingredient's price changed? Nothing is saved.
// Follows the change through batch recipes that use the ingredient (and batches that use those).
export async function previewPriceChange(ingredientId: string, change: PriceChangeInput): Promise<PreviewDish[]> {
  return previewPriceChanges(new Map([[ingredientId, change]]));
}

// The same, for several ingredients at once (used to preview a whole spreadsheet import).
export async function previewPriceChanges(changes: Map<string, PriceChangeInput>): Promise<PreviewDish[]> {
  if (changes.size === 0) return [];
  const all = await prisma.ingredient.findMany({
    select: { id: true, purchaseUnit: true, packQuantity: true, packPrice: true, yieldPct: true },
  });
  const pricing = new Map<string, IngredientPricing>(
    all.map((i) => [
      i.id,
      { purchaseUnit: i.purchaseUnit, packQuantity: Number(i.packQuantity), packPrice: Number(i.packPrice), yieldPct: Number(i.yieldPct) },
    ])
  );
  const changed = new Set<string>();
  for (const [ingredientId, change] of Array.from(changes.entries())) {
    const base = pricing.get(ingredientId);
    if (!base) continue;
    pricing.set(ingredientId, {
      ...base,
      purchaseUnit: change.purchaseUnit ?? base.purchaseUnit,
      packQuantity: change.packQuantity ?? base.packQuantity,
      packPrice: change.packPrice ?? base.packPrice,
      yieldPct: change.yieldPct ?? base.yieldPct,
    });
    changed.add(ingredientId);
  }
  if (changed.size === 0) return [];
  const batches = await prisma.batchRecipe.findMany({
    where: { outputIngredientId: { not: null }, lines: { some: {} } },
    select: { outputIngredientId: true, lines: { select: { ingredientId: true, quantity: true, unit: true } } },
  });
  for (let round = 0; round < 5; round++) {
    let grew = false;
    for (const b of batches) {
      const out = b.outputIngredientId!;
      if (!b.lines.some((l) => changed.has(l.ingredientId))) continue;
      try {
        const total = b.lines.reduce((sum, l) => sum + lineCost(pricing.get(l.ingredientId)!, Number(l.quantity), l.unit), 0);
        const outPricing = pricing.get(out)!;
        if (Math.abs(outPricing.packPrice - total) >= 0.005) {
          pricing.set(out, { ...outPricing, packPrice: total });
          if (!changed.has(out)) grew = true;
          changed.add(out);
        }
      } catch {
        // a batch line with a mismatched unit can't be costed; leave that batch as it is
      }
    }
    if (!grew) break;
  }

  const dishes = await prisma.dish.findMany({
    include: { versions: { orderBy: { versionNumber: "desc" }, take: 1, include: { lines: true } } },
  });
  const result: PreviewDish[] = [];
  for (const d of dishes) {
    const v = d.versions[0];
    if (!v || !v.lines.some((l) => changed.has(l.ingredientId))) continue;
    try {
      const newCost = v.lines.reduce((sum, l) => sum + lineCost(pricing.get(l.ingredientId)!, Number(l.quantity), l.unit), 0);
      const oldCost = Number(v.costSnapshot);
      if (Math.abs(newCost - oldCost) < 0.005) continue;
      const price = v.sellingPrice ? Number(v.sellingPrice) : null;
      result.push({
        dishId: d.id,
        name: d.name,
        oldCost,
        newCost,
        sellingPrice: price,
        oldGpPct: gpFromSellingPrice(oldCost, price)?.gpPct ?? null,
        newGpPct: gpFromSellingPrice(newCost, price)?.gpPct ?? null,
      });
    } catch {
      continue;
    }
  }
  return result.sort((a, b) => Math.abs(b.newCost - b.oldCost) - Math.abs(a.newCost - a.oldCost));
}
