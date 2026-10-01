import { dishVersionCost, gpFromSellingPrice, lineCost, roundUpToMenuPrice, suggestedPriceFromTargetGp, unitCost } from "./costing";
import { expect, test } from "vitest";

const onions = { purchaseUnit: "G" as const, packQuantity: 5000, packPrice: 200, yieldPct: 100 };

test("unit cost is pack price divided by pack quantity", () => {
  expect(unitCost(onions)).toBeCloseTo(0.04, 5); // 200 / 5000
});

test("line cost with 100% yield and matching unit", () => {
  expect(lineCost(onions, 250, "G")).toBeCloseTo(10, 5); // 250g * 0.04
});

test("line cost converts recipe unit to purchase unit", () => {
  expect(lineCost(onions, 0.25, "KG")).toBeCloseTo(10, 5); // 0.25kg = 250g
});

test("line cost scales up for yield loss below 100%", () => {
  const trimmedVeg = { ...onions, yieldPct: 80 };
  // needs 250g usable / 0.8 = 312.5g raw, at 0.04/g = 12.5
  expect(lineCost(trimmedVeg, 250, "G")).toBeCloseTo(12.5, 5);
});

test("throws on zero or negative yield", () => {
  expect(() => lineCost({ ...onions, yieldPct: 0 }, 100, "G")).toThrow(/yield/i);
});

test("each-based ingredient costs correctly", () => {
  const eggs = { purchaseUnit: "EACH" as const, packQuantity: 30, packPrice: 150, yieldPct: 100 };
  expect(lineCost(eggs, 3, "EACH")).toBeCloseTo(15, 5); // 3 eggs * (150/30)
});

const milk = { purchaseUnit: "ML" as const, packQuantity: 1000, packPrice: 45, yieldPct: 100 };

test("dishVersionCost sums every line", () => {
  const cost = dishVersionCost([
    { pricing: onions, quantity: 250, unit: "G" },
    { pricing: milk, quantity: 500, unit: "ML" },
  ]);
  expect(cost).toBeCloseTo(10 + 22.5, 5);
});

test("dishVersionCost of an empty recipe is 0", () => {
  expect(dishVersionCost([])).toBe(0);
});

test("gpFromSellingPrice computes GP baht and GP percent", () => {
  const gp = gpFromSellingPrice(32.5, 130);
  expect(gp?.gpThb).toBeCloseTo(97.5, 5);
  expect(gp?.gpPct).toBeCloseTo(0.75, 5);
});

test("gpFromSellingPrice returns null when no selling price is set", () => {
  expect(gpFromSellingPrice(32.5, null)).toBeNull();
  expect(gpFromSellingPrice(32.5, undefined)).toBeNull();
  expect(gpFromSellingPrice(32.5, 0)).toBeNull();
});

test("suggestedPriceFromTargetGp back-calculates a selling price", () => {
  expect(suggestedPriceFromTargetGp(32.5, 75)).toBeCloseTo(130, 5);
});

test("suggestedPriceFromTargetGp rejects a target of 100 or more", () => {
  expect(() => suggestedPriceFromTargetGp(32.5, 100)).toThrow(/target gp/i);
  expect(() => suggestedPriceFromTargetGp(32.5, 150)).toThrow(/target gp/i);
});

test("roundUpToMenuPrice rounds up to the next 5 baht", () => {
  expect(roundUpToMenuPrice(87.63)).toBe(90);
  expect(roundUpToMenuPrice(90)).toBe(90);
  expect(roundUpToMenuPrice(90.01)).toBe(95);
  expect(roundUpToMenuPrice(0)).toBe(0);
});

test("roundUpToMenuPrice supports other steps and rejects a non-positive step", () => {
  expect(roundUpToMenuPrice(87.63, 10)).toBe(90);
  expect(() => roundUpToMenuPrice(10, 0)).toThrow(/step/i);
});
