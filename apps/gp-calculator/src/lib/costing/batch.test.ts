import { afterEach, expect, test } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { syncBatchOutput, syncBatchesForIngredients, loadBatch, presentBatch } from "./batch";

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
  const flour = await prisma.ingredient.create({
    data: { name: "Flour", category: "Dry", supplierId: supplier.id, purchaseUnit: "G", packQuantity: 1000, packPrice: 40, createdBy: "S", updatedBy: "S" },
  });
  const butter = await prisma.ingredient.create({
    data: { name: "Butter", category: "Dairy", supplierId: supplier.id, purchaseUnit: "G", packQuantity: 500, packPrice: 200, createdBy: "S", updatedBy: "S" },
  });
  return { flour, butter };
}

async function makeBatch(lines: { ingredientId: string; quantity: number; unit: "G" }[], extra = {}) {
  return prisma.batchRecipe.create({
    data: { name: "Brioche Bun", category: "Bakery", yieldQuantity: 10, yieldUnit: "EACH", createdBy: "S", updatedBy: "S", lines: { create: lines }, ...extra },
  });
}

test("publishes the batch as a House-Made ingredient priced at the batch cost", async () => {
  const { flour, butter } = await setup();
  const batch = await makeBatch([
    { ingredientId: flour.id, quantity: 500, unit: "G" }, // 20
    { ingredientId: butter.id, quantity: 100, unit: "G" }, // 40
  ]);
  const out = await syncBatchOutput(batch.id, "Sedary");
  expect(out).toBeTruthy();

  const ing = await prisma.ingredient.findUnique({ where: { id: out! }, include: { supplier: true } });
  expect(ing?.supplier.name).toBe("House-Made");
  expect(ing?.purchaseUnit).toBe("EACH");
  expect(Number(ing?.packQuantity)).toBe(10);
  expect(Number(ing?.packPrice)).toBeCloseTo(60, 5);

  const presented = presentBatch((await loadBatch(batch.id))!);
  expect(presented.totalCost).toBeCloseTo(60, 5);
  expect(presented.costPerUnit).toBeCloseTo(6, 5); // 60 / 10 portions
});

test("a batch with no ingredient lines is a draft and never touches its linked ingredient", async () => {
  const { flour } = await setup();
  const linked = await prisma.ingredient.create({
    data: { name: "Sourdough", category: "Bakery", supplierId: flour.supplierId, purchaseUnit: "EACH", packQuantity: 1, packPrice: 15, createdBy: "S", updatedBy: "S" },
  });
  const batch = await makeBatch([], { name: "Sourdough", outputIngredientId: linked.id, yieldQuantity: 1 });
  expect(await syncBatchOutput(batch.id, "Sedary")).toBeNull();
  expect(Number((await prisma.ingredient.findUnique({ where: { id: linked.id } }))?.packPrice)).toBe(15);
  expect(presentBatch((await loadBatch(batch.id))!).isDraft).toBe(true);
});

test("re-syncing after an ingredient price change reports the output as changed; an unchanged re-sync does not", async () => {
  const { flour } = await setup();
  const batch = await makeBatch([{ ingredientId: flour.id, quantity: 500, unit: "G" }]);
  await syncBatchOutput(batch.id, "Sedary");
  expect(await syncBatchOutput(batch.id, "Sedary")).toBeNull(); // nothing changed

  await prisma.ingredient.update({ where: { id: flour.id }, data: { packPrice: 80 } });
  const changed = await syncBatchesForIngredients([flour.id], "Sedary");
  expect(changed).toHaveLength(1);
  const out = await prisma.ingredient.findUnique({ where: { id: changed[0] } });
  expect(Number(out?.packPrice)).toBeCloseTo(40, 5);
});

test("a batch it cannot recost is reported by name instead of skipped silently", async () => {
  const { flour } = await setup();
  const batch = await makeBatch([{ ingredientId: flour.id, quantity: 500, unit: "G" }]);
  await syncBatchOutput(batch.id, "Sedary");
  // the pack is now counted in EACH, so a gram line can no longer be costed
  await prisma.ingredient.update({ where: { id: flour.id }, data: { purchaseUnit: "EACH" } });

  const skipped: string[] = [];
  const changed = await syncBatchesForIngredients([flour.id], "Sedary", skipped);
  expect(changed).toEqual([]);
  expect(skipped).toEqual(["Brioche Bun"]);
});

test("a batch that uses another batch's output cascades a price change through both", async () => {
  const { flour } = await setup();
  const dough = await makeBatch([{ ingredientId: flour.id, quantity: 1000, unit: "G" }], { name: "Dough", yieldQuantity: 1000, yieldUnit: "G" });
  const doughOut = (await syncBatchOutput(dough.id, "Sedary"))!;
  const loaf = await makeBatch([{ ingredientId: doughOut, quantity: 500, unit: "G" }], { name: "Loaf", yieldQuantity: 2 });
  const loafOut = (await syncBatchOutput(loaf.id, "Sedary"))!;
  expect(Number((await prisma.ingredient.findUnique({ where: { id: loafOut } }))?.packPrice)).toBeCloseTo(20, 5);

  await prisma.ingredient.update({ where: { id: flour.id }, data: { packPrice: 80 } });
  const changed = await syncBatchesForIngredients([flour.id], "Sedary");
  expect(changed.sort()).toEqual([doughOut, loafOut].sort());
  expect(Number((await prisma.ingredient.findUnique({ where: { id: loafOut } }))?.packPrice)).toBeCloseTo(40, 5);
});

test("a gram batch with a portion size reports portions and cost per portion", async () => {
  const { flour } = await setup();
  const batch = await prisma.batchRecipe.create({
    data: {
      name: "Banana Bread", category: "Bakery", yieldQuantity: 1800, yieldUnit: "G", portionSize: 200,
      createdBy: "S", updatedBy: "S",
      lines: { create: [{ ingredientId: flour.id, quantity: 900, unit: "G" }] }, // 36
    },
  });
  const presented = presentBatch((await loadBatch(batch.id))!);
  expect(presented.portions).toBe(9);
  expect(presented.costPerPortion).toBeCloseTo(4, 5); // 36 / 9
});

test("a gram batch without a portion size has no portion count", async () => {
  const { flour } = await setup();
  const batch = await makeBatch([{ ingredientId: flour.id, quantity: 500, unit: "G" }], { yieldUnit: "G", yieldQuantity: 1000 });
  const presented = presentBatch((await loadBatch(batch.id))!);
  expect(presented.portions).toBeNull();
  expect(presented.costPerPortion).toBeNull();
});

test("a batch with a menu price reports its GP from the cost per portion", async () => {
  const { flour } = await setup();
  const batch = await makeBatch([{ ingredientId: flour.id, quantity: 500, unit: "G" }], { sellingPrice: 80 }); // 20 cost / 10 portions = 2
  const presented = presentBatch((await loadBatch(batch.id))!);
  expect(presented.costPerPortion).toBeCloseTo(2, 5);
  expect(presented.gpPct).toBeCloseTo(0.975, 5);
});
