import { afterEach, expect, test } from "vitest";
import { prisma } from "./prisma";
import { buildOrderPlan } from "./ordering";

afterEach(async () => {
  await prisma.batchRecipeLine.deleteMany();
  await prisma.batchRecipe.deleteMany();
  await prisma.dishVersion.deleteMany();
  await prisma.dish.deleteMany();
  await prisma.ingredient.deleteMany();
  await prisma.supplier.deleteMany();
});

async function world() {
  const makro = await prisma.supplier.create({ data: { name: "Makro", createdBy: "S", updatedBy: "S" } });
  const farm = await prisma.supplier.create({ data: { name: "Farm", createdBy: "S", updatedBy: "S" } });
  const house = await prisma.supplier.create({ data: { name: "House-Made", createdBy: "S", updatedBy: "S" } });
  const mk = (name: string, supplierId: string, purchaseUnit: "G" | "ML" | "EACH", packQuantity: number, packPrice: number, yieldPct = 100) =>
    prisma.ingredient.create({ data: { name, category: "X", supplierId, purchaseUnit, packQuantity, packPrice, yieldPct, createdBy: "S", updatedBy: "S" } });
  return { makro, farm, house, mk };
}

async function dishOf(name: string, lines: { ingredientId: string; quantity: number; unit: "G" | "KG" | "ML" | "L" | "EACH" }[]) {
  const dish = await prisma.dish.create({ data: { name, category: "Mains", createdBy: "S" } });
  await prisma.dishVersion.create({
    data: {
      dishId: dish.id, versionNumber: 1, costSnapshot: 1, createdBy: "S",
      lines: { create: lines.map((l) => ({ ...l, ingredientNameSnapshot: "x", lineCostSnapshot: 1 })) },
    },
  });
  return dish;
}

test("scales a dish by portions, rounds up to whole packs and groups by supplier", async () => {
  const { makro, farm, mk } = await world();
  const flour = await mk("Flour", makro.id, "G", 1000, 40);
  const eggs = await mk("Eggs", farm.id, "EACH", 30, 150);
  const dish = await dishOf("Pancakes", [
    { ingredientId: flour.id, quantity: 0.1, unit: "KG" }, // 100 g
    { ingredientId: eggs.id, quantity: 2, unit: "EACH" },
  ]);

  const plan = await buildOrderPlan([{ kind: "dish", id: dish.id, quantity: 25 }]);
  expect(plan.suppliers.map((s) => s.supplier)).toEqual(["Farm", "Makro"]);
  const flourLine = plan.suppliers[1].lines[0];
  expect(flourLine.needed).toBeCloseTo(2500, 5); // 25 x 100 g
  expect(flourLine.packsToBuy).toBe(3); // 2.5 packs -> 3
  expect(flourLine.orderCost).toBe(120);
  expect(flourLine.useCost).toBeCloseTo(100, 5);
  expect(plan.suppliers[0].lines[0].packsToBuy).toBe(2); // 50 eggs -> 2 trays of 30
  expect(plan.totalOrderCost).toBe(120 + 300);
});

test("opens up a batch recipe used by a dish and buys its ingredients", async () => {
  const { makro, house, mk } = await world();
  const flour = await mk("Flour", makro.id, "G", 1000, 40);
  const bun = await mk("Bun", house.id, "EACH", 10, 20);
  await prisma.batchRecipe.create({
    data: {
      name: "Bun", category: "Bakery", yieldQuantity: 10, yieldUnit: "EACH", outputIngredientId: bun.id, createdBy: "S", updatedBy: "S",
      lines: { create: [{ ingredientId: flour.id, quantity: 500, unit: "G" }] }, // 500 g flour makes 10 buns
    },
  });
  const burger = await dishOf("Burger", [{ ingredientId: bun.id, quantity: 1, unit: "EACH" }]);

  const plan = await buildOrderPlan([{ kind: "dish", id: burger.id, quantity: 40 }]); // 40 buns = 4 batches = 2000 g
  expect(plan.suppliers).toHaveLength(1);
  expect(plan.suppliers[0].supplier).toBe("Makro");
  expect(plan.suppliers[0].lines[0].needed).toBeCloseTo(2000, 5);
  expect(plan.suppliers[0].lines[0].packsToBuy).toBe(2);
});

test("yield below 100% means buying more than the recipe uses", async () => {
  const { farm, mk } = await world();
  const carrot = await mk("Carrot", farm.id, "G", 1000, 30, 80);
  const dish = await dishOf("Salad", [{ ingredientId: carrot.id, quantity: 400, unit: "G" }]);
  const plan = await buildOrderPlan([{ kind: "dish", id: dish.id, quantity: 1 }]);
  expect(plan.suppliers[0].lines[0].needed).toBeCloseTo(500, 5); // 400 / 0.8
});

test("a batch with no recipe yet is reported instead of silently missing", async () => {
  const { house, mk } = await world();
  const sauce = await mk("Hollandaise", house.id, "G", 500, 100);
  await prisma.batchRecipe.create({
    data: { name: "Hollandaise", category: "Sauces", yieldQuantity: 500, yieldUnit: "G", outputIngredientId: sauce.id, createdBy: "S", updatedBy: "S" },
  });
  const dish = await dishOf("Benedict", [{ ingredientId: sauce.id, quantity: 50, unit: "G" }]);
  const plan = await buildOrderPlan([{ kind: "dish", id: dish.id, quantity: 10 }]);
  expect(plan.warnings[0]).toMatch(/Hollandaise has no recipe yet/);
});
