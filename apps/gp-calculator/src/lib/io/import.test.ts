import { readFileSync } from "fs";
import path from "path";
import { afterEach, expect, test } from "vitest";
import { parseImportRows, importIngredients } from "./import";
import { prisma } from "@/lib/db/prisma";

afterEach(async () => {
  await prisma.dishVersion.deleteMany();
  await prisma.dish.deleteMany();
  await prisma.ingredient.deleteMany();
  await prisma.supplier.deleteMany();
});

const fixturePath = path.join(__dirname, "fixtures/sample-import.csv");
const xlsxFixturePath = path.join(__dirname, "fixtures/sample-import.xlsx");

test("parseImportRows reads a CSV into row objects", () => {
  const rows = parseImportRows(readFileSync(fixturePath), "sample-import.csv");
  expect(rows).toHaveLength(3);
  expect(rows[0]).toMatchObject({ name: "Onions", packPrice: "200" });
});

test("parseImportRows reads an XLSX file into row objects, using raw cell values rather than currency-formatted display text", () => {
  // sample-import.xlsx has the same 3 rows as the CSV fixture, but its packPrice
  // cells (Onions, Milk) carry an Excel currency number format ("$200.00"), so
  // this also guards against a regression to raw:false, which would return the
  // formatted string "$200.00" instead of the raw numeric value.
  const rows = parseImportRows(readFileSync(xlsxFixturePath), "sample-import.xlsx");
  expect(rows).toHaveLength(3);
  expect(rows[0]).toMatchObject({ name: "Onions", packPrice: "200" });
  expect(rows[1]).toMatchObject({ name: "Milk", packPrice: "45" });
});

test("importIngredients imports an XLSX file end-to-end, skipping the invalid row", async () => {
  const rows = parseImportRows(readFileSync(xlsxFixturePath), "sample-import.xlsx");
  const result = await importIngredients(rows, "Sedary");

  expect(result.created).toBe(2);
  expect(result.skipped).toEqual([{ row: 4, reason: expect.stringMatching(/price/i) }]);

  const ingredients = await prisma.ingredient.findMany();
  expect(ingredients.map((i) => i.name).sort()).toEqual(["Milk", "Onions"]);
});

test("importIngredients creates suppliers and ingredients, skipping invalid rows", async () => {
  const rows = parseImportRows(readFileSync(fixturePath), "sample-import.csv");
  const result = await importIngredients(rows, "Sedary");

  expect(result.created).toBe(2);
  expect(result.skipped).toEqual([{ row: 4, reason: expect.stringMatching(/price/i) }]);

  const ingredients = await prisma.ingredient.findMany();
  expect(ingredients.map((i) => i.name).sort()).toEqual(["Milk", "Onions"]);
});

test("importIngredients skips a row with an empty/zero pack quantity instead of storing 0", async () => {
  const rows = [
    { name: "Flour", category: "Dry", supplier: "Fresh Farms Co", purchaseUnit: "G", packQuantity: "", packPrice: "150", yieldPct: "100" },
  ];
  const result = await importIngredients(rows, "Sedary");

  expect(result.created).toBe(0);
  expect(result.skipped).toEqual([{ row: 2, reason: expect.stringMatching(/pack quantity/i) }]);
  const ingredients = await prisma.ingredient.findMany();
  expect(ingredients).toHaveLength(0);
});

test("importIngredients skips a row with yieldPct of 0 instead of storing an unusable yield", async () => {
  const rows = [
    { name: "Butter", category: "Dairy", supplier: "Fresh Farms Co", purchaseUnit: "G", packQuantity: "500", packPrice: "120", yieldPct: "0" },
  ];
  const result = await importIngredients(rows, "Sedary");

  expect(result.created).toBe(0);
  expect(result.skipped).toEqual([{ row: 2, reason: expect.stringMatching(/yield/i) }]);
});

test("importIngredients skips a row with yieldPct above 100", async () => {
  const rows = [
    { name: "Cream", category: "Dairy", supplier: "Fresh Farms Co", purchaseUnit: "G", packQuantity: "500", packPrice: "120", yieldPct: "150" },
  ];
  const result = await importIngredients(rows, "Sedary");

  expect(result.created).toBe(0);
  expect(result.skipped).toEqual([{ row: 2, reason: expect.stringMatching(/yield/i) }]);
});

test("importIngredients skips a row with a non-numeric packPrice instead of storing NaN", async () => {
  const rows = [
    { name: "Rice", category: "Dry", supplier: "Fresh Farms Co", purchaseUnit: "G", packQuantity: "5000", packPrice: "฿200", yieldPct: "100" },
  ];
  const result = await importIngredients(rows, "Sedary");

  expect(result.created).toBe(0);
  expect(result.skipped).toEqual([{ row: 2, reason: expect.stringMatching(/price/i) }]);
  const ingredients = await prisma.ingredient.findMany();
  expect(ingredients).toHaveLength(0);
});

test("importIngredients still skips a row with an unknown purchase unit", async () => {
  const rows = [
    { name: "Oil", category: "Dry", supplier: "Fresh Farms Co", purchaseUnit: "LB", packQuantity: "5000", packPrice: "200", yieldPct: "100" },
  ];
  const result = await importIngredients(rows, "Sedary");

  expect(result.created).toBe(0);
  expect(result.skipped).toEqual([{ row: 2, reason: expect.stringMatching(/unknown purchase unit/i) }]);
});

test("importIngredients updates an existing ingredient matched by name+supplier instead of duplicating", async () => {
  const rows = parseImportRows(readFileSync(fixturePath), "sample-import.csv");
  await importIngredients(rows, "Sedary");

  const priceUpdateRows = [{ name: "Onions", category: "Veg", supplier: "Fresh Farms Co", purchaseUnit: "G", packQuantity: "5000", packPrice: "220", yieldPct: "100" }];
  const result = await importIngredients(priceUpdateRows, "Sedary");

  expect(result.created).toBe(0);
  expect(result.updated).toBe(1);
  const onions = await prisma.ingredient.findMany({ where: { name: "Onions" } });
  expect(onions).toHaveLength(1);
  expect(Number(onions[0].packPrice)).toBe(220);
  expect(result.priceChangedIngredientIds).toEqual([onions[0].id]);
});

test("importIngredients reports no price change when a re-uploaded row is identical to what's already stored", async () => {
  const rows = parseImportRows(readFileSync(fixturePath), "sample-import.csv");
  await importIngredients(rows, "Sedary");

  // Re-import the exact same rows unchanged (e.g. re-uploading a downloaded template
  // without editing it) -- these are "updated" matches, but nothing actually changed.
  const result = await importIngredients(rows, "Sedary");

  expect(result.updated).toBe(2);
  expect(result.priceChangedIngredientIds).toEqual([]);
});

test("importIngredients flags a price change even when only packQuantity or purchaseUnit changes, not just packPrice", async () => {
  const rows = parseImportRows(readFileSync(fixturePath), "sample-import.csv");
  await importIngredients(rows, "Sedary");

  const packSizeChangeRows = [{ name: "Onions", category: "Veg", supplier: "Fresh Farms Co", purchaseUnit: "G", packQuantity: "10000", packPrice: "200", yieldPct: "100" }];
  const result = await importIngredients(packSizeChangeRows, "Sedary");

  const onions = await prisma.ingredient.findMany({ where: { name: "Onions" } });
  expect(result.priceChangedIngredientIds).toEqual([onions[0].id]);
});

async function estimatedBacon() {
  const placeholder = await prisma.supplier.create({ data: { name: "Placeholder / Estimated", createdBy: "S", updatedBy: "S" } });
  return prisma.ingredient.create({
    data: { name: "Bacon", category: "Meat", supplierId: placeholder.id, purchaseUnit: "G", packQuantity: 1000, packPrice: 400, priceEstimated: true, createdBy: "S", updatedBy: "S" },
  });
}

const HEADER = "name,category,supplier,purchaseUnit,packQuantity,packPrice,yieldPct";
const csvRows = (line: string) => parseImportRows(Buffer.from(`${HEADER}\n${line}`), "t.csv");

test("a row with a real supplier confirms the matching estimated ingredient, keeping its id", async () => {
  const bacon = await estimatedBacon();
  const result = await importIngredients(csvRows("Bacon,Meat,La Bottega,G,1000,520,100"), "Sedary");

  expect(result.confirmed).toBe(1);
  expect(result.created).toBe(0);
  expect(result.priceChangedIngredientIds).toEqual([bacon.id]);
  const all = await prisma.ingredient.findMany({ include: { supplier: true } });
  expect(all).toHaveLength(1); // moved, not duplicated
  expect(all[0].id).toBe(bacon.id);
  expect(all[0].supplier.name).toBe("La Bottega");
  expect(all[0].priceEstimated).toBe(false);
  expect(Number(all[0].packPrice)).toBe(520);
});

test("a row left under the placeholder supplier updates the price but stays an estimate", async () => {
  const bacon = await estimatedBacon();
  const result = await importIngredients(csvRows("Bacon,Meat,Placeholder / Estimated,G,1000,450,100"), "Sedary");

  expect(result.confirmed).toBe(0);
  const after = await prisma.ingredient.findUnique({ where: { id: bacon.id } });
  expect(after?.priceEstimated).toBe(true);
  expect(Number(after?.packPrice)).toBe(450);
});

test("a real-supplier row with no estimate to confirm just creates the ingredient", async () => {
  const result = await importIngredients(csvRows("Cheese,Dairy,La Bottega,G,1000,300,100"), "Sedary");
  expect(result.confirmed).toBe(0);
  expect(result.created).toBe(1);
  expect((await prisma.ingredient.findFirst({ where: { name: "Cheese" } }))?.priceEstimated).toBe(false);
});

import { previewImport } from "./import";

test("previewImport reports counts, skipped rows and affected dishes without writing anything", async () => {
  const supplier = await prisma.supplier.create({ data: { name: "Fresh Farms Co", createdBy: "S", updatedBy: "S" } });
  const onions = await prisma.ingredient.create({
    data: { name: "Onions", category: "Veg", supplierId: supplier.id, purchaseUnit: "G", packQuantity: 5000, packPrice: 200, createdBy: "S", updatedBy: "S" },
  });
  const dish = await prisma.dish.create({ data: { name: "Onion Soup", category: "Starter", createdBy: "S" } });
  await prisma.dishVersion.create({
    data: {
      dishId: dish.id, versionNumber: 1, costSnapshot: 10, sellingPrice: 40, createdBy: "S",
      lines: { create: [{ ingredientId: onions.id, ingredientNameSnapshot: "Onions", quantity: 250, unit: "G", lineCostSnapshot: 10 }] },
    },
  });

  const csv = [
    HEADER,
    "Onions,Veg,Fresh Farms Co,G,5000,400,100", // doubles the price
    "Garlic,Veg,Fresh Farms Co,G,1000,90,100", // new
    "Bad,Veg,Fresh Farms Co,G,1000,,100", // no price
  ].join("\n");
  const result = await previewImport(parseImportRows(Buffer.from(csv), "t.csv"));

  expect(result).toMatchObject({ created: 1, updated: 1, unchanged: 0 });
  expect(result.skipped).toEqual([{ row: 4, reason: expect.stringMatching(/price/i) }]);
  expect(result.dishes).toHaveLength(1);
  expect(result.dishes[0]).toMatchObject({ name: "Onion Soup", oldCost: 10, newCost: 20 });

  // nothing was written
  expect(await prisma.ingredient.count()).toBe(1);
  expect(Number((await prisma.ingredient.findUnique({ where: { id: onions.id } }))?.packPrice)).toBe(200);
  expect(await prisma.dishVersion.count()).toBe(1);
});

test("previewImport counts an estimate being confirmed and rows that change nothing", async () => {
  await estimatedBacon();
  const real = await prisma.supplier.create({ data: { name: "La Bottega", createdBy: "S", updatedBy: "S" } });
  await prisma.ingredient.create({
    data: { name: "Cheese", category: "Dairy", supplierId: real.id, purchaseUnit: "G", packQuantity: 1000, packPrice: 300, createdBy: "S", updatedBy: "S" },
  });
  const csv = [HEADER, "Bacon,Meat,La Bottega,G,1000,520,100", "Cheese,Dairy,La Bottega,G,1000,300,100"].join("\n");
  const result = await previewImport(parseImportRows(Buffer.from(csv), "t.csv"));
  expect(result).toMatchObject({ created: 0, updated: 2, confirmed: 1, unchanged: 1 });
});
