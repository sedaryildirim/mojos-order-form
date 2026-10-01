export interface UnitPriceInput {
  purchaseUnit: string;
  packQuantity: number;
  packPrice: number;
  yieldPct?: number;
}

// Price of one comparable unit (per kg, per litre or each), so packs of different sizes line up.
// Yield is applied, so it is the price of the usable part.
export function unitPrice(i: UnitPriceInput): { value: number; label: string } {
  const perBase = i.packPrice / i.packQuantity / ((i.yieldPct ?? 100) / 100);
  if (i.purchaseUnit === "G") return { value: perBase * 1000, label: "per kg" };
  if (i.purchaseUnit === "ML") return { value: perBase * 1000, label: "per l" };
  return { value: perBase, label: "each" };
}

const UNIT_WORD: Record<string, string> = { G: "g", ML: "ml", EACH: "pcs" };

// "5000 g", "1000 ml", "30 pcs": pack sizes as people say them, not as codes.
export function packLabel(quantity: number, unit: string): string {
  return `${quantity} ${UNIT_WORD[unit] ?? unit}`;
}

export function unitWord(unit: string): string {
  return UNIT_WORD[unit] ?? unit;
}
