import { prisma } from "@/lib/db/prisma";
import { gpFromSellingPrice, TARGET_GP_PCT } from "@/lib/costing/costing";
import { dishAttention, findEstimatedIngredientIds, batchAttention } from "@/lib/costing/estimates";

export interface LowGpDish {
  id: string;
  name: string;
  cost: number;
  price: number;
  gpPct: number;
}

export interface HomeSummary {
  dishCount: number;
  ingredientCount: number;
  supplierCount: number;
  lowGp: LowGpDish[];
  unpricedDishes: number;
  estimatedIngredients: number;
  dishesNeedingUpdate: number;
  batchesNeedingUpdate: number;
  recentlyChanged: { id: string; name: string; oldCost: number | null; newCost: number; at: Date }[];
}

// Everything the home page shows: what to look at first, worst margins at the top.
export const RECENT_DAYS = 14;

export async function getHomeSummary(now = new Date()): Promise<HomeSummary> {
  const [dishes, batches, estimatedIds, ingredientCount, supplierCount, estimatedIngredients] = await Promise.all([
    prisma.dish.findMany({ include: { versions: { orderBy: { versionNumber: "desc" }, take: 2, include: { lines: true } } } }),
    prisma.batchRecipe.findMany({ select: { id: true, lines: { select: { ingredientId: true, ingredient: { select: { name: true } } } } } }),
    findEstimatedIngredientIds(),
    prisma.ingredient.count({ where: { archived: false } }),
    prisma.supplier.count({ where: { archived: false } }),
    prisma.ingredient.count({ where: { archived: false, priceEstimated: true } }),
  ]);

  const lowGp: LowGpDish[] = [];
  let unpricedDishes = 0;
  const recentlyChanged: HomeSummary["recentlyChanged"] = [];
  for (const d of dishes) {
    const latest = d.versions[0];
    if (!latest) continue;
    const cost = Number(latest.costSnapshot);
    const price = latest.sellingPrice ? Number(latest.sellingPrice) : null;
    const gp = gpFromSellingPrice(cost, price);
    if (!gp) unpricedDishes++;
    else if (gp.gpPct * 100 < TARGET_GP_PCT) lowGp.push({ id: d.id, name: d.name, cost, price: price!, gpPct: gp.gpPct });
    const recentSince = now.getTime() - RECENT_DAYS * 86400000;
    if (latest.source === "AUTO_PRICE_REFRESH" && latest.createdAt.getTime() >= recentSince) {
      recentlyChanged.push({
        id: d.id,
        name: d.name,
        oldCost: d.versions[1] ? Number(d.versions[1].costSnapshot) : null,
        newCost: cost,
        at: latest.createdAt,
      });
    }
  }
  lowGp.sort((a, b) => a.gpPct - b.gpPct);
  recentlyChanged.sort((a, b) => b.at.getTime() - a.at.getTime());

  return {
    dishCount: dishes.length,
    ingredientCount,
    supplierCount,
    lowGp,
    unpricedDishes,
    estimatedIngredients,
    dishesNeedingUpdate: dishAttention(dishes, estimatedIds).size,
    batchesNeedingUpdate: batchAttention(batches, estimatedIds).size,
    recentlyChanged: recentlyChanged.slice(0, 5),
  };
}
