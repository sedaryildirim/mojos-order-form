import { prisma } from "@/lib/db/prisma";

// Stores the ingredient's current price, pack, yield and supplier as a history row.
// Call it right after anything that changes them (and once when an ingredient is created).
export async function recordPriceHistory(ingredientId: string, actor: string): Promise<void> {
  const ing = await prisma.ingredient.findUnique({ where: { id: ingredientId }, include: { supplier: { select: { name: true } } } });
  if (!ing) return;
  await prisma.ingredientPriceHistory.create({
    data: {
      ingredientId,
      supplierName: ing.supplier.name,
      purchaseUnit: ing.purchaseUnit,
      packQuantity: ing.packQuantity,
      packPrice: ing.packPrice,
      yieldPct: ing.yieldPct,
      recordedBy: actor,
    },
  });
}

export interface PriceHistoryEntry {
  id: string;
  recordedAt: Date;
  recordedBy: string;
  supplierName: string;
  purchaseUnit: "G" | "ML" | "EACH";
  packQuantity: number;
  packPrice: number;
  yieldPct: number;
  unitPrice: number;
  // change in the comparable unit price versus the previous entry, as a fraction (0.1 = +10%); null for the first entry
  changePct: number | null;
}

export async function getPriceHistory(ingredientId: string): Promise<PriceHistoryEntry[]> {
  const rows = await prisma.ingredientPriceHistory.findMany({ where: { ingredientId }, orderBy: { recordedAt: "asc" } });
  const entries: PriceHistoryEntry[] = [];
  let prev: number | null = null;
  for (const r of rows) {
    const packQuantity = Number(r.packQuantity);
    const packPrice = Number(r.packPrice);
    const yieldPct = Number(r.yieldPct);
    const unitPrice = packPrice / packQuantity / (yieldPct / 100);
    entries.push({
      id: r.id,
      recordedAt: r.recordedAt,
      recordedBy: r.recordedBy,
      supplierName: r.supplierName,
      purchaseUnit: r.purchaseUnit,
      packQuantity,
      packPrice,
      yieldPct,
      unitPrice,
      changePct: prev === null || prev === 0 ? null : (unitPrice - prev) / prev,
    });
    prev = unitPrice;
  }
  return entries.reverse(); // newest first
}
