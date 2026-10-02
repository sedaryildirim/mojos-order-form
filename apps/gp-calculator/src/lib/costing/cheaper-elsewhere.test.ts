import { expect, test } from "vitest";
import { cheaperElsewhere, CheaperInput } from "./cheaper-elsewhere";

function ing(id: string, supplierId: string, supplierName: string, packPrice: number, extra: Partial<CheaperInput> = {}): CheaperInput {
  return { id, name: "Chicken Breast", purchaseUnit: "G", packQuantity: "1000", packPrice: String(packPrice), yieldPct: "100", supplierId, supplier: { name: supplierName }, estimateNote: null, ...extra };
}

test("points at the cheapest same-named item from another supplier when it is meaningfully cheaper", () => {
  const result = cheaperElsewhere([ing("a", "s1", "Makro", 100), ing("b", "s2", "Local", 80)]);
  expect(result.get("a")).toEqual({ supplier: "Local", pctCheaper: 20 });
  expect(result.has("b")).toBe(false);
});

test("ignores a difference of under 5 percent", () => {
  expect(cheaperElsewhere([ing("a", "s1", "Makro", 100), ing("b", "s2", "Local", 97)]).size).toBe(0);
});

test("never suggests an estimate or a House-Made item, and never compares across units", () => {
  const result = cheaperElsewhere([
    ing("a", "s1", "Makro", 100),
    ing("b", "s2", "Guess", 10, { estimateNote: "Estimated price" }),
    ing("c", "s3", "House-Made", 10),
    ing("d", "s4", "Fruit", 10, { purchaseUnit: "ML" }),
  ]);
  expect(result.size).toBe(0);
});

test("accounts for yield", () => {
  const result = cheaperElsewhere([ing("a", "s1", "Makro", 100), ing("b", "s2", "Local", 80, { yieldPct: "50" })]);
  expect(result.has("a")).toBe(false); // 80 at 50% yield costs 160 per usable kg
  expect(result.get("b")).toEqual({ supplier: "Makro", pctCheaper: 38 });
});
