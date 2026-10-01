import { afterEach, expect, test } from "vitest";
import { prisma } from "./prisma";
import { previewPriceChange } from "./preview";

afterEach(async () => {
  await prisma.batchRecipeLine.deleteMany();
  await prisma.batchRecipe.deleteMany();
  await prisma.dishVersion.deleteMany();
  await prisma.dish.deleteMany();
  await prisma.ingredient.deleteMany();
  await prisma.supplier.deleteMany();
});

async function setup() {
  const supplier = await prisma.supplier.create({ data: { name: "Makro", createdBy: "S", updatedBy: "S" } });
  const make = (name: string, packPrice: number, packQuantity = 1000) =>
    prisma.ingredient.create({
      data: { name, category: "X", supplierId: supplier.id, purchaseUnit: "G", packQuantity, packPrice, createdBy: "S", updatedBy: "S" },
    });
  const flour = await make("Flour", 40);
  const other = await make("Other", 100);
  const dish = async (name: string, price: number, lines: { id: string; qty: number; cost: number }[]) => {
    const d = await prisma.dish.create({ data: { name, category: "Mains", createdBy: "S" } });
    await prisma.dishVersion.create({
      data: {
        dishId: d.id, versionNumber: 1, costSnapshot: lines.reduce((s, l) => s + l.cost, 0), sellingPrice: price, createdBy: "S",
        lines: { create: lines.map((l) => ({ ingredientId: l.id, ingredientNameSnapshot: "x", quantity: l.qty, unit: "G" as const, lineCostSnapshot: l.cost })) },
      },
    });
    return d;
  };
  return { supplier, flour, other, make, dish };
}

test("previews the new cost and GP of dishes that use the ingredient, without saving anything", async () => {
  const { flour, other, dish } = await setup();
  await dish("Bread", 100, [{ id: flour.id, qty: 500, cost: 20 }]);
  await dish("Unrelated", 100, [{ id: other.id, qty: 100, cost: 10 }]);

  const result = await previewPriceChange(flour.id, { packPrice: 80 });
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({ name: "Bread", oldCost: 20, newCost: 40, sellingPrice: 100 });
  expect(result[0].oldGpPct).toBeCloseTo(0.8, 5);
  expect(result[0].newGpPct).toBeCloseTo(0.6, 5);
  expect(Number((await prisma.ingredient.findUnique({ where: { id: flour.id } }))?.packPrice)).toBe(40);
});

test("follows the change through a batch recipe that uses the ingredient", async () => {
  const { supplier, flour, dish } = await setup();
  const bun = await prisma.ingredient.create({
    data: { name: "Bun", category: "Bakery", supplierId: supplier.id, purchaseUnit: "EACH", packQuantity: 10, packPrice: 20, createdBy: "S", updatedBy: "S" },
  });
  await prisma.batchRecipe.create({
    data: {
      name: "Bun", category: "Bakery", yieldQuantity: 10, yieldUnit: "EACH", outputIngredientId: bun.id, createdBy: "S", updatedBy: "S",
      lines: { create: [{ ingredientId: flour.id, quantity: 500, unit: "G" }] }, // 20 for the batch
    },
  });
  const d = await prisma.dish.create({ data: { name: "Burger", category: "Burgers", createdBy: "S" } });
  await prisma.dishVersion.create({
    data: {
      dishId: d.id, versionNumber: 1, costSnapshot: 2, sellingPrice: 100, createdBy: "S",
      lines: { create: [{ ingredientId: bun.id, ingredientNameSnapshot: "Bun", quantity: 1, unit: "EACH", lineCostSnapshot: 2 }] },
    },
  });
  void dish;

  const result = await previewPriceChange(flour.id, { packPrice: 80 }); // batch cost 20 -> 40, so each bun 2 -> 4
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({ name: "Burger", oldCost: 2 });
  expect(result[0].newCost).toBeCloseTo(4, 5);
});

test("reports nothing when the change does not move any dish cost", async () => {
  const { flour, dish } = await setup();
  await dish("Bread", 100, [{ id: flour.id, qty: 500, cost: 20 }]);
  expect(await previewPriceChange(flour.id, { packPrice: 40 })).toEqual([]);
});
