import { afterEach, expect, test } from "vitest";
import { prisma } from "./prisma";
import { getPriceHistory, recordPriceHistory } from "./price-history";

afterEach(async () => {
  await prisma.ingredient.deleteMany();
  await prisma.supplier.deleteMany();
});

async function makeIngredient() {
  const supplier = await prisma.supplier.create({ data: { name: "Makro", createdBy: "S", updatedBy: "S" } });
  return prisma.ingredient.create({
    data: { name: "Flour", category: "Dry", supplierId: supplier.id, purchaseUnit: "G", packQuantity: 1000, packPrice: 40, createdBy: "S", updatedBy: "S" },
  });
}

test("history is newest first and shows the change in unit price against the previous entry", async () => {
  const flour = await makeIngredient();
  await recordPriceHistory(flour.id, "Sedary");
  await prisma.ingredient.update({ where: { id: flour.id }, data: { packPrice: 44 } });
  await recordPriceHistory(flour.id, "Sid");

  const history = await getPriceHistory(flour.id);
  expect(history).toHaveLength(2);
  expect(history[0]).toMatchObject({ packPrice: 44, recordedBy: "Sid", supplierName: "Makro" });
  expect(history[0].changePct).toBeCloseTo(0.1, 5); // 40 -> 44
  expect(history[1].changePct).toBeNull(); // the first entry has nothing to compare with
});

test("a pack size change with the same price shows up as a unit price change", async () => {
  const flour = await makeIngredient();
  await recordPriceHistory(flour.id, "Sedary");
  await prisma.ingredient.update({ where: { id: flour.id }, data: { packQuantity: 2000 } });
  await recordPriceHistory(flour.id, "Sedary");
  expect((await getPriceHistory(flour.id))[0].changePct).toBeCloseTo(-0.5, 5);
});
