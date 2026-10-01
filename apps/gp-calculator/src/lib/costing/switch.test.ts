import { afterEach, expect, test } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { findCheaperAlternative, switchIngredient } from "./switch";

afterEach(async () => {
  await prisma.batchRecipeLine.deleteMany();
  await prisma.batchRecipe.deleteMany();
  await prisma.dishVersion.deleteMany();
  await prisma.dish.deleteMany();
  await prisma.ingredient.deleteMany();
  await prisma.supplier.deleteMany();
});

async function setup() {
  const a = await prisma.supplier.create({ data: { name: "Supplier A", createdBy: "S", updatedBy: "S" } });
  const b = await prisma.supplier.create({ data: { name: "Supplier B", createdBy: "S", updatedBy: "S" } });
  const make = (name: string, supplierId: string, packPrice: number, extra = {}) =>
    prisma.ingredient.create({
      data: { name, category: "Veg", supplierId, purchaseUnit: "G", packQuantity: 1000, packPrice, createdBy: "S", updatedBy: "S", ...extra },
    });
  const dear = await make("Parsley", a.id, 200);
  const cheap = await make("Parsley 100 g", b.id, 100);
  return { a, b, dear, cheap, make };
}

test("finds a same-named item that is meaningfully cheaper at another supplier", async () => {
  const { dear, cheap } = await setup();
  const found = await findCheaperAlternative(dear.id);
  expect(found).toMatchObject({ id: cheap.id, supplier: "Supplier B", pctCheaper: 50 });
  expect(await findCheaperAlternative(cheap.id)).toBeNull();
});

test("ignores estimated prices and near-identical prices", async () => {
  const { dear, cheap } = await setup();
  await prisma.ingredient.update({ where: { id: cheap.id }, data: { priceEstimated: true } });
  expect(await findCheaperAlternative(dear.id)).toBeNull();
  await prisma.ingredient.update({ where: { id: cheap.id }, data: { priceEstimated: false, packPrice: 195 } });
  expect(await findCheaperAlternative(dear.id)).toBeNull();
});

test("switching repoints batch lines and gives dishes a new version at the new price", async () => {
  const { dear, cheap } = await setup();
  const dish = await prisma.dish.create({ data: { name: "Salad", category: "Starter", createdBy: "S" } });
  await prisma.dishVersion.create({
    data: {
      dishId: dish.id, versionNumber: 1, costSnapshot: 20, sellingPrice: 100, createdBy: "S",
      lines: { create: [{ ingredientId: dear.id, ingredientNameSnapshot: "Parsley", quantity: 100, unit: "G", lineCostSnapshot: 20 }] },
    },
  });
  const dressing = await prisma.ingredient.create({
    data: { name: "Dressing", category: "Sauce", supplierId: dear.supplierId, purchaseUnit: "G", packQuantity: 500, packPrice: 50, createdBy: "S", updatedBy: "S" },
  });
  await prisma.batchRecipe.create({
    data: { name: "Dressing", category: "Sauce", yieldQuantity: 500, yieldUnit: "G", outputIngredientId: dressing.id, createdBy: "S", updatedBy: "S",
      lines: { create: [{ ingredientId: dear.id, quantity: 250, unit: "G" }] } },
  });

  const result = await switchIngredient(dear.id, cheap.id, "Sedary");
  expect(result.dishesSwitched).toBe(1);
  expect(result.batchesSwitched).toBe(1);

  const versions = await prisma.dishVersion.findMany({ where: { dishId: dish.id }, orderBy: { versionNumber: "asc" }, include: { lines: true } });
  expect(versions).toHaveLength(2);
  expect(versions[1].source).toBe("AUTO_PRICE_REFRESH");
  expect(versions[1].lines[0].ingredientId).toBe(cheap.id);
  expect(Number(versions[1].costSnapshot)).toBeCloseTo(10, 5); // 100 g at 100/1000
  expect(Number(versions[0].costSnapshot)).toBe(20); // history untouched

  const lines = await prisma.batchRecipeLine.findMany();
  expect(lines[0].ingredientId).toBe(cheap.id);
});

test("refuses to switch between different unit families", async () => {
  const { dear, a } = await setup();
  const liquid = await prisma.ingredient.create({
    data: { name: "Oil", category: "Oil", supplierId: a.id, purchaseUnit: "ML", packQuantity: 1000, packPrice: 10, createdBy: "S", updatedBy: "S" },
  });
  await expect(switchIngredient(dear.id, liquid.id, "Sedary")).rejects.toThrow(/different units/);
});
