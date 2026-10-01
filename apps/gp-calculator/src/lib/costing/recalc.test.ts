import { afterEach, expect, test } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { recalculateDishVersionsForIngredients } from "./recalc";

afterEach(async () => {
  await prisma.dishVersion.deleteMany();
  await prisma.dish.deleteMany();
  await prisma.ingredient.deleteMany();
  await prisma.supplier.deleteMany();
});

async function setup() {
  const supplier = await prisma.supplier.create({ data: { name: "Fresh Farms Co", createdBy: "S", updatedBy: "S" } });
  const onions = await prisma.ingredient.create({
    data: { name: "Onions", category: "Veg", supplierId: supplier.id, purchaseUnit: "G", packQuantity: 5000, packPrice: 200, createdBy: "S", updatedBy: "S" },
  });
  const dish = await prisma.dish.create({ data: { name: "Onion Soup", category: "Starter", createdBy: "S" } });
  const v1 = await prisma.dishVersion.create({
    data: {
      dishId: dish.id,
      versionNumber: 1,
      costSnapshot: 10,
      sellingPrice: 40,
      createdBy: "S",
      lines: {
        create: [{ ingredientId: onions.id, ingredientNameSnapshot: "Onions", quantity: 250, unit: "G", lineCostSnapshot: 10 }],
      },
    },
  });
  return { supplier, onions, dish, v1 };
}

test("returns an empty summary when no ingredient ids are given", async () => {
  const result = await recalculateDishVersionsForIngredients([], "Sedary");
  expect(result).toEqual([]);
});

test("creates a new AUTO_PRICE_REFRESH version recosted at the ingredient's new price, carrying selling price forward", async () => {
  const { onions, dish } = await setup();
  await prisma.ingredient.update({ where: { id: onions.id }, data: { packPrice: 400 } }); // price doubles

  const summary = await recalculateDishVersionsForIngredients([onions.id], "Sedary");

  expect(summary).toEqual([{ dishId: dish.id, dishName: "Onion Soup", versionNumber: 2, oldCost: 10, newCost: 20, sellingPrice: 40, gpPct: 0.5 }]);

  const versions = await prisma.dishVersion.findMany({ where: { dishId: dish.id }, orderBy: { versionNumber: "asc" }, include: { lines: true } });
  expect(versions).toHaveLength(2);
  expect(versions[0].source).toBe("MANUAL");
  expect(Number(versions[0].costSnapshot)).toBe(10); // untouched, immutable
  expect(versions[1].source).toBe("AUTO_PRICE_REFRESH");
  expect(Number(versions[1].costSnapshot)).toBe(20);
  expect(Number(versions[1].sellingPrice)).toBe(40);
  expect(Number(versions[1].lines[0].lineCostSnapshot)).toBe(20);
});

test("does not touch a dish whose latest version doesn't use the changed ingredient", async () => {
  const { onions } = await setup();
  const otherSupplier = await prisma.supplier.create({ data: { name: "Other Co", createdBy: "S", updatedBy: "S" } });
  const salt = await prisma.ingredient.create({
    data: { name: "Salt", category: "Dry", supplierId: otherSupplier.id, purchaseUnit: "G", packQuantity: 1000, packPrice: 30, createdBy: "S", updatedBy: "S" },
  });
  const unrelatedDish = await prisma.dish.create({ data: { name: "Salted Fries", category: "Side", createdBy: "S" } });
  await prisma.dishVersion.create({
    data: {
      dishId: unrelatedDish.id,
      versionNumber: 1,
      costSnapshot: 3,
      createdBy: "S",
      lines: { create: [{ ingredientId: salt.id, ingredientNameSnapshot: "Salt", quantity: 100, unit: "G", lineCostSnapshot: 3 }] },
    },
  });

  await prisma.ingredient.update({ where: { id: onions.id }, data: { packPrice: 400 } });
  const summary = await recalculateDishVersionsForIngredients([onions.id], "Sedary");

  expect(summary.map((s) => s.dishId)).not.toContain(unrelatedDish.id);
  const unrelatedVersions = await prisma.dishVersion.findMany({ where: { dishId: unrelatedDish.id } });
  expect(unrelatedVersions).toHaveLength(1); // no new version created
});

test("only recalculates from the LATEST version, ignoring older versions that also used the ingredient", async () => {
  const { onions, dish, v1 } = await setup();

  // Amend the dish to a v2 that no longer uses onions.
  const otherSupplier = await prisma.supplier.create({ data: { name: "Other Co", createdBy: "S", updatedBy: "S" } });
  const carrots = await prisma.ingredient.create({
    data: { name: "Carrots", category: "Veg", supplierId: otherSupplier.id, purchaseUnit: "G", packQuantity: 1000, packPrice: 50, createdBy: "S", updatedBy: "S" },
  });
  await prisma.dishVersion.create({
    data: {
      dishId: dish.id,
      versionNumber: 2,
      costSnapshot: 5,
      createdBy: "S",
      lines: { create: [{ ingredientId: carrots.id, ingredientNameSnapshot: "Carrots", quantity: 100, unit: "G", lineCostSnapshot: 5 }] },
    },
  });

  await prisma.ingredient.update({ where: { id: onions.id }, data: { packPrice: 400 } });
  const summary = await recalculateDishVersionsForIngredients([onions.id], "Sedary");

  expect(summary).toEqual([]);
  const versions = await prisma.dishVersion.findMany({ where: { dishId: dish.id } });
  expect(versions).toHaveLength(2); // no v3 created
  expect(v1.id).toBeTruthy(); // v1 still exists, untouched, just no longer "latest"
});

test("skips a dish it can't recost (unit-family mismatch) instead of throwing, and continues with other dishes", async () => {
  const { onions, dish } = await setup();

  const meatSupplier = await prisma.supplier.create({ data: { name: "Meat Co", createdBy: "S", updatedBy: "S" } });
  const eggs = await prisma.ingredient.create({
    data: { name: "Eggs", category: "Dairy", supplierId: meatSupplier.id, purchaseUnit: "EACH", packQuantity: 12, packPrice: 90, createdBy: "S", updatedBy: "S" },
  });
  const omelette = await prisma.dish.create({ data: { name: "Omelette", category: "Main", createdBy: "S" } });
  await prisma.dishVersion.create({
    data: {
      dishId: omelette.id,
      versionNumber: 1,
      costSnapshot: 7.5,
      createdBy: "S",
      lines: { create: [{ ingredientId: eggs.id, ingredientNameSnapshot: "Eggs", quantity: 1, unit: "EACH", lineCostSnapshot: 7.5 }] },
    },
  });
  // Corrupt the ingredient's unit family after the recipe line was written --
  // simulates a price-refresh import that also changed purchaseUnit incompatibly.
  await prisma.ingredient.update({ where: { id: eggs.id }, data: { purchaseUnit: "G" } });
  await prisma.ingredient.update({ where: { id: onions.id }, data: { packPrice: 400 } });

  const summary = await recalculateDishVersionsForIngredients([onions.id, eggs.id], "Sedary");

  // Onion Soup recosts fine; Omelette is skipped rather than throwing.
  expect(summary.map((s) => s.dishId)).toEqual([dish.id]);
  const omeletteVersions = await prisma.dishVersion.findMany({ where: { dishId: omelette.id } });
  expect(omeletteVersions).toHaveLength(1);
});
