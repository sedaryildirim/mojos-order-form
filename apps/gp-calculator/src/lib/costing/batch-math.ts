// How many portions a batch makes: the yield itself when counted in portions, otherwise
// yield divided by the portion size (g or ml). Null when there's no way to tell.
export function batchPortions(
  yieldQuantity: number,
  yieldUnit: "G" | "ML" | "EACH",
  portionSize: number | null
): number | null {
  if (yieldUnit === "EACH") return yieldQuantity;
  if (portionSize && portionSize > 0) return yieldQuantity / portionSize;
  return null;
}
