import { prisma } from "@/lib/db/prisma";
import { convert, Unit } from "@/lib/costing/units";
import { findEstimatedIngredientIds } from "@/lib/costing/estimates";

export interface PlanItem {
  kind: "dish" | "batch";
  id: string;
  // dish: number of portions to make; batch: number of batches
  quantity: number;
}

export interface OrderLine {
  ingredientId: string;
  name: string;
  purchaseUnit: "G" | "ML" | "EACH";
  needed: number; // in the purchase unit, including waste from yield
  packQuantity: number;
  packPrice: number;
  packsToBuy: number;
  orderCost: number; // what the packs cost
  useCost: number; // what the amount actually used costs
  estimated: boolean;
}

export interface SupplierOrder {
  supplier: string;
  lines: OrderLine[];
  orderCost: number;
}

export interface OrderPlan {
  suppliers: SupplierOrder[];
  totalOrderCost: number;
  totalUseCost: number;
  warnings: string[];
}

const MAX_DEPTH = 6;

// Turns "make 40 burgers and 2 batches of focaccia" into what to buy, grouped by supplier.
// Batch recipes are opened up, so their ingredients are bought, not the batch itself.
export async function buildOrderPlan(items: PlanItem[]): Promise<OrderPlan> {
  const [ingredients, batches, estimated] = await Promise.all([
    prisma.ingredient.findMany({ include: { supplier: { select: { name: true } } } }),
    prisma.batchRecipe.findMany({ include: { lines: true } }),
    findEstimatedIngredientIds(),
  ]);
  const ingById = new Map(ingredients.map((i) => [i.id, i]));
  const batchByOutput = new Map(batches.filter((b) => b.outputIngredientId).map((b) => [b.outputIngredientId!, b]));
  const batchById = new Map(batches.map((b) => [b.id, b]));

  const needs = new Map<string, number>();
  const warnings = new Set<string>();

  // qty is in the ingredient's own purchase unit and is the amount actually used
  function addNeed(ingredientId: string, qty: number, depth: number) {
    const ing = ingById.get(ingredientId);
    if (!ing || !(qty > 0)) return;
    const batch = batchByOutput.get(ingredientId);
    if (batch && batch.lines.length > 0 && depth < MAX_DEPTH) {
      const factor = qty / Number(batch.yieldQuantity);
      for (const l of batch.lines) {
        const lineIng = ingById.get(l.ingredientId);
        if (!lineIng) continue;
        addNeed(l.ingredientId, convert(Number(l.quantity), l.unit as Unit, lineIng.purchaseUnit) * factor, depth + 1);
      }
      return;
    }
    if (batch) warnings.add(`${ing.name} has no recipe yet, so its ingredients are not on this list.`);
    needs.set(ingredientId, (needs.get(ingredientId) ?? 0) + qty / (Number(ing.yieldPct) / 100));
  }

  const dishIds = items.filter((i) => i.kind === "dish").map((i) => i.id);
  const dishes = await prisma.dish.findMany({
    where: { id: { in: dishIds } },
    include: { versions: { orderBy: { versionNumber: "desc" }, take: 1, include: { lines: true } } },
  });
  const dishById = new Map(dishes.map((d) => [d.id, d]));

  for (const item of items) {
    if (!(item.quantity > 0)) continue;
    if (item.kind === "dish") {
      const latest = dishById.get(item.id)?.versions[0];
      if (!latest) continue;
      for (const l of latest.lines) {
        const ing = ingById.get(l.ingredientId);
        if (!ing) continue;
        addNeed(l.ingredientId, convert(Number(l.quantity), l.unit as Unit, ing.purchaseUnit) * item.quantity, 0);
      }
    } else {
      const batch = batchById.get(item.id);
      if (!batch) continue;
      if (batch.lines.length === 0) warnings.add(`${batch.name} has no ingredients yet.`);
      for (const l of batch.lines) {
        const ing = ingById.get(l.ingredientId);
        if (!ing) continue;
        addNeed(l.ingredientId, convert(Number(l.quantity), l.unit as Unit, ing.purchaseUnit) * item.quantity, 1);
      }
    }
  }

  const bySupplier = new Map<string, OrderLine[]>();
  for (const [id, needed] of Array.from(needs.entries())) {
    const ing = ingById.get(id)!;
    const packQuantity = Number(ing.packQuantity);
    const packPrice = Number(ing.packPrice);
    const packsToBuy = Math.ceil(needed / packQuantity - 1e-9);
    const line: OrderLine = {
      ingredientId: id,
      name: ing.name,
      purchaseUnit: ing.purchaseUnit,
      needed,
      packQuantity,
      packPrice,
      packsToBuy,
      orderCost: packsToBuy * packPrice,
      useCost: (needed * packPrice) / packQuantity,
      estimated: estimated.has(id),
    };
    bySupplier.set(ing.supplier.name, [...(bySupplier.get(ing.supplier.name) ?? []), line]);
  }

  const suppliers: SupplierOrder[] = Array.from(bySupplier.entries())
    .map(([supplier, lines]) => ({
      supplier,
      lines: lines.sort((a, b) => a.name.localeCompare(b.name)),
      orderCost: lines.reduce((s, l) => s + l.orderCost, 0),
    }))
    .sort((a, b) => a.supplier.localeCompare(b.supplier));

  return {
    suppliers,
    totalOrderCost: suppliers.reduce((s, x) => s + x.orderCost, 0),
    totalUseCost: suppliers.reduce((s, x) => s + x.lines.reduce((t, l) => t + l.useCost, 0), 0),
    warnings: Array.from(warnings),
  };
}
