import { prisma } from "@/lib/db/prisma";
import { batchPortions } from "./batch-math";
import { gpFromSellingPrice } from "./costing";

// Prisma hands back Decimal objects; they convert cleanly with Number().
type Numeric = number | string | { toString(): string };

// The chart shows the most recent updates only.
export const MAX_UPDATES = 6;

export interface GpPoint {
  id: string;
  // ISO timestamp, so the point can cross from the server to the browser.
  at: string;
  label: string;
  reason: string;
  cost: number;
  sellingPrice: number | null;
  // 0 to 100; null when there is no menu price to measure against.
  gpPct: number | null;
}

const gpOf = (cost: number, price: number | null) => {
  const gp = gpFromSellingPrice(cost, price);
  return gp ? gp.gpPct * 100 : null;
};

// Each dish version is one update: a new version is written whenever the recipe or an ingredient price changes,
// and it keeps its own cost and menu price.
export function dishGpHistory(
  versions: { id: string; versionNumber: number; createdAt: Date; costSnapshot: Numeric; sellingPrice: Numeric | null; source: string }[]
): GpPoint[] {
  const sorted = [...versions].sort((a, b) => a.versionNumber - b.versionNumber);
  const points = sorted.map((v, i) => {
    const cost = Number(v.costSnapshot);
    const sellingPrice = v.sellingPrice === null ? null : Number(v.sellingPrice);
    const reason = i === 0 ? "Recipe created" : v.source === "AUTO_PRICE_REFRESH" ? "Ingredient prices updated" : "Recipe edited";
    return { id: v.id, at: v.createdAt.toISOString(), label: `v${v.versionNumber}`, reason, cost, sellingPrice, gpPct: gpOf(cost, sellingPrice) };
  });
  return points.slice(-MAX_UPDATES);
}

// A batch has no versions, but the ingredient it publishes records a history row each time its cost changes.
// A point is the cost of one portion (or of the whole batch when it has no portion size).
export function batchGpHistory(
  entries: { id: string; recordedAt: Date; packPrice: Numeric; packQuantity: Numeric; purchaseUnit: "G" | "ML" | "EACH" }[],
  batch: { portionSize: number | null; sellingPrice: number | null }
): GpPoint[] {
  const sorted = [...entries].sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
  const points: GpPoint[] = [];
  let prev: string | null = null;
  for (const e of sorted) {
    const packPrice = Number(e.packPrice);
    const packQuantity = Number(e.packQuantity);
    const signature = `${packPrice}|${packQuantity}`;
    if (signature === prev) continue;
    prev = signature;
    const portions = batchPortions(packQuantity, e.purchaseUnit, batch.portionSize) ?? 1;
    const cost = packPrice / portions;
    points.push({
      id: e.id, at: e.recordedAt.toISOString(), label: `#${points.length + 1}`, reason: points.length === 0 ? "Batch created" : "Ingredient prices changed",
      cost, sellingPrice: batch.sellingPrice, gpPct: gpOf(cost, batch.sellingPrice),
    });
  }
  // Labels count from the first change ever recorded, so keep them stable when only the last few are shown.
  return points.slice(-MAX_UPDATES);
}

export async function loadDishGpHistory(dishId: string): Promise<GpPoint[]> {
  const versions = await prisma.dishVersion.findMany({
    where: { dishId },
    orderBy: { versionNumber: "asc" },
    select: { id: true, versionNumber: true, createdAt: true, costSnapshot: true, sellingPrice: true, source: true },
  });
  return dishGpHistory(versions);
}

export async function loadBatchGpHistory(batchId: string): Promise<GpPoint[]> {
  const batch = await prisma.batchRecipe.findUnique({ where: { id: batchId } });
  if (!batch?.outputIngredientId) return [];
  const entries = await prisma.ingredientPriceHistory.findMany({
    where: { ingredientId: batch.outputIngredientId },
    orderBy: { recordedAt: "asc" },
    select: { id: true, recordedAt: true, packPrice: true, packQuantity: true, purchaseUnit: true },
  });
  return batchGpHistory(entries, {
    portionSize: batch.portionSize === null ? null : Number(batch.portionSize),
    sellingPrice: batch.sellingPrice === null ? null : Number(batch.sellingPrice),
  });
}
