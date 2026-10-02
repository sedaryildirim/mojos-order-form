import { comparableName } from "./ingredient-compare";

export interface CheaperInput {
  id: string;
  name: string;
  purchaseUnit: string;
  packQuantity: string;
  packPrice: string;
  yieldPct: string;
  supplierId: string;
  supplier: { name: string };
  estimateNote: string | null;
}

export interface CheaperOption {
  supplier: string;
  pctCheaper: number;
}

const usablePrice = (i: CheaperInput) => Number(i.packPrice) / Number(i.packQuantity) / (Number(i.yieldPct) / 100);

// For each ingredient: the cheapest same-named item (same unit) from another supplier, if it is at least 5% cheaper
// per usable unit. Estimates and House-Made items are never suggested.
export function cheaperElsewhere(ingredients: CheaperInput[]): Map<string, CheaperOption> {
  const byName = new Map<string, CheaperInput[]>();
  for (const i of ingredients) {
    const key = `${comparableName(i.name)}|${i.purchaseUnit}`;
    byName.set(key, [...(byName.get(key) ?? []), i]);
  }
  const result = new Map<string, CheaperOption>();
  for (const group of Array.from(byName.values())) {
    if (group.length < 2) continue;
    for (const i of group) {
      const best = group
        .filter((o) => o.supplierId !== i.supplierId && !o.estimateNote && o.supplier.name !== "House-Made")
        .sort((a, b) => usablePrice(a) - usablePrice(b))[0];
      if (best && usablePrice(best) < usablePrice(i) * 0.95) {
        result.set(i.id, { supplier: best.supplier.name, pctCheaper: Math.round((1 - usablePrice(best) / usablePrice(i)) * 100) });
      }
    }
  }
  return result;
}
