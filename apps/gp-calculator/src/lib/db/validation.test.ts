import { ingredientInputSchema, supplierInputSchema } from "./validation";
import { expect, test } from "vitest";

test("supplier schema requires a non-empty name and createdBy", () => {
  const result = supplierInputSchema.safeParse({ name: "", createdBy: "" });
  expect(result.success).toBe(false);
});

test("supplier schema accepts a valid supplier", () => {
  const result = supplierInputSchema.safeParse({
    name: "Fresh Farms Co",
    contactInfo: "081-234-5678",
    createdBy: "Sedary",
  });
  expect(result.success).toBe(true);
});

test("ingredient schema rejects zero or negative packPrice", () => {
  const result = ingredientInputSchema.safeParse({
    name: "Onions",
    category: "Veg",
    supplierId: "abc",
    purchaseUnit: "G",
    packQuantity: 5000,
    packPrice: 0,
    yieldPct: 100,
    createdBy: "Sedary",
  });
  expect(result.success).toBe(false);
});

test("ingredient schema rejects zero or negative packQuantity", () => {
  const base = {
    name: "Onions",
    category: "Veg",
    supplierId: "abc",
    purchaseUnit: "G" as const,
    packPrice: 200,
    createdBy: "Sedary",
  };
  expect(ingredientInputSchema.safeParse({ ...base, packQuantity: 0 }).success).toBe(false);
  expect(ingredientInputSchema.safeParse({ ...base, packQuantity: -5 }).success).toBe(false);
  expect(ingredientInputSchema.safeParse({ ...base, packQuantity: 5000 }).success).toBe(true);
});

test("ingredient schema rejects yieldPct outside (0, 100]", () => {
  const base = {
    name: "Onions",
    category: "Veg",
    supplierId: "abc",
    purchaseUnit: "G" as const,
    packQuantity: 5000,
    packPrice: 200,
    createdBy: "Sedary",
  };
  expect(ingredientInputSchema.safeParse({ ...base, yieldPct: 0 }).success).toBe(false);
  expect(ingredientInputSchema.safeParse({ ...base, yieldPct: 101 }).success).toBe(false);
  expect(ingredientInputSchema.safeParse({ ...base, yieldPct: 100 }).success).toBe(true);
});

import { LIMITS, dishInputSchema, batchRecipeInputSchema } from "./validation";

test("names, categories and contact details have length limits", () => {
  const long = (n: number) => "x".repeat(n);
  expect(supplierInputSchema.safeParse({ name: long(LIMITS.name + 1), createdBy: "A" }).success).toBe(false);
  expect(supplierInputSchema.safeParse({ name: long(LIMITS.name), createdBy: "A" }).success).toBe(true);
  expect(supplierInputSchema.safeParse({ name: "A", contactInfo: long(LIMITS.contact + 1), createdBy: "A" }).success).toBe(false);
  expect(dishInputSchema.safeParse({ name: "A", category: long(LIMITS.category + 1), createdBy: "A" }).success).toBe(false);
  expect(batchRecipeInputSchema.safeParse({ name: "A", category: "B", yieldQuantity: 1, yieldUnit: "G", notes: long(LIMITS.notes + 1), createdBy: "A" }).success).toBe(false);
});

test("a name of only spaces is rejected", () => {
  expect(supplierInputSchema.safeParse({ name: "   ", createdBy: "A" }).success).toBe(false);
});
