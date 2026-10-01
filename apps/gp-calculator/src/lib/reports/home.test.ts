import { afterEach, expect, test } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { getHomeSummary } from "./home";

afterEach(async () => {
  await prisma.dishVersion.deleteMany();
  await prisma.dish.deleteMany();
  await prisma.ingredient.deleteMany();
  await prisma.supplier.deleteMany();
});

async function dishWith(name: string, cost: number, price: number | null, ingredientId: string, source: "MANUAL" | "AUTO_PRICE_REFRESH" = "MANUAL") {
  const dish = await prisma.dish.create({ data: { name, category: "Mains", createdBy: "S" } });
  await prisma.dishVersion.create({
    data: {
      dishId: dish.id, versionNumber: 1, costSnapshot: cost, sellingPrice: price, source, createdBy: "S",
      lines: { create: [{ ingredientId, ingredientNameSnapshot: "X", quantity: 1, unit: "G", lineCostSnapshot: cost }] },
    },
  });
  return dish;
}

test("summarises low-GP dishes worst first, unpriced dishes and estimated prices", async () => {
  const supplier = await prisma.supplier.create({ data: { name: "Makro", createdBy: "S", updatedBy: "S" } });
  const base = { category: "X", supplierId: supplier.id, purchaseUnit: "G" as const, packQuantity: 1000, packPrice: 100, createdBy: "S", updatedBy: "S" };
  const real = await prisma.ingredient.create({ data: { ...base, name: "Real" } });
  const guess = await prisma.ingredient.create({ data: { ...base, name: "Guess", priceEstimated: true } });

  await dishWith("Healthy", 20, 100, real.id); // 80% GP
  await dishWith("Thin", 60, 100, guess.id); // 40% GP, uses an estimate
  await dishWith("Thinner", 80, 100, real.id, "AUTO_PRICE_REFRESH"); // 20% GP
  await dishWith("Unpriced", 10, null, real.id);

  const s = await getHomeSummary();
  expect(s.dishCount).toBe(4);
  expect(s.lowGp.map((d) => d.name)).toEqual(["Thinner", "Thin"]);
  expect(s.unpricedDishes).toBe(1);
  expect(s.estimatedIngredients).toBe(1);
  expect(s.dishesNeedingUpdate).toBe(1);
  expect(s.recentlyChanged.map((d) => d.name)).toEqual(["Thinner"]);
});

test("recently recosted only lists dishes recosted in the last 14 days", async () => {
  const supplier = await prisma.supplier.create({ data: { name: "Makro", createdBy: "S", updatedBy: "S" } });
  const ing = await prisma.ingredient.create({
    data: { name: "Flour", category: "X", supplierId: supplier.id, purchaseUnit: "G", packQuantity: 1000, packPrice: 40, createdBy: "S", updatedBy: "S" },
  });
  const fresh = await dishWith("Fresh", 20, 100, ing.id, "AUTO_PRICE_REFRESH");
  const stale = await dishWith("Stale", 20, 100, ing.id, "AUTO_PRICE_REFRESH");
  await prisma.dishVersion.updateMany({ where: { dishId: stale.id }, data: { createdAt: new Date(Date.now() - 30 * 86400000) } });
  void fresh;

  const s = await getHomeSummary();
  expect(s.recentlyChanged.map((d) => d.name)).toEqual(["Fresh"]);
});
