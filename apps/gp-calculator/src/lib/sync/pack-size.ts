interface PackSize {
  purchaseUnit: "G" | "ML" | "EACH";
  packQuantity: number;
  needsPackSize: boolean;
}
type Unit = PackSize["purchaseUnit"];

// "5 kg", "470 g", "700gr", "946 ml", "18 l", "30 pcs", optionally "x 3" for a multipack.
const SIZE = /(\d+(?:\.\d+)?)\s*(kg|gr|g|ml|l|pcs|pc)\b(?:\s*x\s*(\d+))?/i;

// What the GP stores for an order-sheet item: the unit and the size of one pack as bought.
// A Kilogram item is priced per kg, so its pack is 1000 g. Anything unreadable becomes 1 EACH and is flagged.
export function parsePackSize(name: string, sheetUnit: string, override?: { purchaseUnit: Unit; packQuantity: number }): PackSize {
  if (override) return { ...override, needsPackSize: false };
  if (sheetUnit === "Kilogram") return { purchaseUnit: "G", packQuantity: 1000, needsPackSize: false };
  if (sheetUnit === "Bottle") return { purchaseUnit: "EACH", packQuantity: 1, needsPackSize: false };
  const m = SIZE.exec(name);
  if (!m) return { purchaseUnit: "EACH", packQuantity: 1, needsPackSize: true };
  const qty = Number(m[1]) * (m[3] ? Number(m[3]) : 1);
  switch (m[2].toLowerCase()) {
    case "kg":
      return { purchaseUnit: "G", packQuantity: qty * 1000, needsPackSize: false };
    case "g":
    case "gr":
      return { purchaseUnit: "G", packQuantity: qty, needsPackSize: false };
    case "l":
      return { purchaseUnit: "ML", packQuantity: qty * 1000, needsPackSize: false };
    case "ml":
      return { purchaseUnit: "ML", packQuantity: qty, needsPackSize: false };
    default:
      return { purchaseUnit: "EACH", packQuantity: qty, needsPackSize: false };
  }
}
