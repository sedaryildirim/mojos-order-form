import { convert, Unit } from "./units";

export interface IngredientPricing {
  purchaseUnit: Unit;
  packQuantity: number;
  packPrice: number;
  yieldPct: number;
}

export function unitCost(pricing: IngredientPricing): number {
  return pricing.packPrice / pricing.packQuantity;
}

export function lineCost(
  pricing: IngredientPricing,
  quantityUsed: number,
  usedUnit: Unit
): number {
  if (pricing.yieldPct <= 0) {
    throw new Error("Ingredient yield% must be greater than 0");
  }
  const rawQuantity = convert(quantityUsed, usedUnit, pricing.purchaseUnit);
  const adjustedForYield = rawQuantity / (pricing.yieldPct / 100);
  return adjustedForYield * unitCost(pricing);
}

export interface RecipeLine {
  pricing: IngredientPricing;
  quantity: number;
  unit: Unit;
}

export function dishVersionCost(lines: RecipeLine[]): number {
  return lines.reduce((sum, line) => sum + lineCost(line.pricing, line.quantity, line.unit), 0);
}

export function gpFromSellingPrice(
  cost: number,
  sellingPrice: number | null | undefined
): { gpThb: number; gpPct: number } | null {
  if (!sellingPrice || sellingPrice <= 0) return null;
  const gpThb = sellingPrice - cost;
  return { gpThb, gpPct: gpThb / sellingPrice };
}

export function suggestedPriceFromTargetGp(cost: number, targetGpPct: number): number {
  if (targetGpPct >= 100 || targetGpPct < 0) {
    throw new Error("Target GP% must be between 0 and 99");
  }
  return cost / (1 - targetGpPct / 100);
}

export const TARGET_GP_PCT = 75;

// Rounds a price up to the next menu-friendly step (default 5 baht), never below the input.
export function roundUpToMenuPrice(price: number, step = 5): number {
  if (!(step > 0)) throw new Error("Step must be greater than 0");
  return Math.ceil(price / step - 1e-9) * step + 0; // + 0 turns -0 into 0
}
