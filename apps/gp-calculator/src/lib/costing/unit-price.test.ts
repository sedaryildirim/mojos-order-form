import { expect, test } from "vitest";
import { packLabel, unitPrice } from "./unit-price";

test("weight and volume packs are compared per kg and per litre", () => {
  expect(unitPrice({ purchaseUnit: "G", packQuantity: 5000, packPrice: 200 })).toEqual({ value: 40, label: "per kg" });
  expect(unitPrice({ purchaseUnit: "ML", packQuantity: 1000, packPrice: 70 })).toEqual({ value: 70, label: "per l" });
});

test("counted packs are priced each, and yield raises the usable price", () => {
  expect(unitPrice({ purchaseUnit: "EACH", packQuantity: 30, packPrice: 147 })).toEqual({ value: 4.9, label: "each" });
  expect(unitPrice({ purchaseUnit: "G", packQuantity: 1000, packPrice: 100, yieldPct: 50 }).value).toBeCloseTo(200, 5);
});

test("pack sizes read as people say them", () => {
  expect(packLabel(5000, "G")).toBe("5000 g");
  expect(packLabel(1000, "ML")).toBe("1000 ml");
  expect(packLabel(30, "EACH")).toBe("30 pcs");
});
