import { prisma } from "./prisma";
import { afterEach, expect, test } from "vitest";

afterEach(async () => {
  await prisma.versionIngredient.deleteMany();
  await prisma.dishVersion.deleteMany();
  await prisma.dish.deleteMany();
  await prisma.ingredient.deleteMany();
  await prisma.supplier.deleteMany();
});

test("creates and reads a supplier", async () => {
  const created = await prisma.supplier.create({
    data: { name: "Fresh Farms Co", createdBy: "Sedary", updatedBy: "Sedary" },
  });
  const found = await prisma.supplier.findUnique({ where: { id: created.id } });
  expect(found?.name).toBe("Fresh Farms Co");
  expect(found?.archived).toBe(false);
});

test("creates a dish version with a line and reads it back", async () => {
  const supplier = await prisma.supplier.create({ data: { name: "Fresh Farms Co", createdBy: "S", updatedBy: "S" } });
  const onions = await prisma.ingredient.create({
    data: { name: "Onions", category: "Veg", supplierId: supplier.id, purchaseUnit: "G", packQuantity: 5000, packPrice: 200, createdBy: "S", updatedBy: "S" },
  });
  const dish = await prisma.dish.create({ data: { name: "Onion Soup", category: "Starter", createdBy: "S" } });
  const version = await prisma.dishVersion.create({
    data: {
      dishId: dish.id, versionNumber: 1, costSnapshot: 10, createdBy: "S",
      lines: { create: [{ ingredientId: onions.id, ingredientNameSnapshot: "Onions", quantity: 250, unit: "G", lineCostSnapshot: 10 }] },
    },
    include: { lines: true },
  });
  expect(version.lines).toHaveLength(1);
  expect(version.shareToken).toBeTruthy();
});
