import { prisma } from "@/lib/prisma";
import { afterEach, expect, test } from "vitest";
import { GET, PATCH } from "./route";
import { NextRequest } from "next/server";

afterEach(async () => {
  await prisma.dishVersion.deleteMany();
  await prisma.dish.deleteMany();
  await prisma.ingredient.deleteMany();
  await prisma.supplier.deleteMany();
});

async function makeSupplier() {
  return prisma.supplier.create({ data: { name: "Fresh Farms Co", createdBy: "S", updatedBy: "S" } });
}

test("PATCH returns a clean 404 for a non-existent ingredient", async () => {
  const req = new NextRequest("http://localhost/api/ingredients/does-not-exist", {
    method: "PATCH",
    body: JSON.stringify({ archived: true, updatedBy: "Sedary" }),
  });
  const res = await PATCH(req, { params: { id: "does-not-exist" } });
  expect(res.status).toBe(404);
  const body = await res.json();
  expect(body.error).toBe("Not found");
});

test("PATCH with only {archived, updatedBy} does not reset yieldPct to the schema default", async () => {
  const supplier = await makeSupplier();
  const ingredient = await prisma.ingredient.create({
    data: {
      name: "Onions",
      category: "Veg",
      supplierId: supplier.id,
      purchaseUnit: "G",
      packQuantity: 5000,
      packPrice: 200,
      yieldPct: 80,
      createdBy: "S",
      updatedBy: "S",
    },
  });

  const req = new NextRequest(`http://localhost/api/ingredients/${ingredient.id}`, {
    method: "PATCH",
    body: JSON.stringify({ archived: true, updatedBy: "S" }),
  });
  const res = await PATCH(req, { params: { id: ingredient.id } });
  expect(res.status).toBe(200);

  const getRes = await GET(new NextRequest(`http://localhost/api/ingredients/${ingredient.id}`), {
    params: { id: ingredient.id },
  });
  const fetched = await getRes.json();
  expect(Number(fetched.yieldPct)).toBe(80);
  expect(fetched.archived).toBe(true);
});

async function estimatedBacon() {
  const placeholder = await prisma.supplier.create({ data: { name: "Placeholder / Estimated", createdBy: "S", updatedBy: "S" } });
  const real = await prisma.supplier.create({ data: { name: "La Bottega", createdBy: "S", updatedBy: "S" } });
  const bacon = await prisma.ingredient.create({
    data: { name: "Bacon", category: "Meat", supplierId: placeholder.id, purchaseUnit: "G", packQuantity: 1000, packPrice: 400, priceEstimated: true, createdBy: "S", updatedBy: "S" },
  });
  return { placeholder, real, bacon };
}

const patch = (id: string, body: object) =>
  PATCH(new NextRequest(`http://localhost/api/ingredients/${id}`, { method: "PATCH", body: JSON.stringify(body) }), { params: { id } });

test("an estimated price can't be confirmed while the supplier is still the placeholder", async () => {
  const { bacon } = await estimatedBacon();
  const res = await patch(bacon.id, { priceEstimated: false, updatedBy: "Sedary" });
  expect(res.status).toBe(400);
  expect((await prisma.ingredient.findUnique({ where: { id: bacon.id } }))?.priceEstimated).toBe(true);
});

test("confirming with a real supplier clears the estimate flag", async () => {
  const { bacon, real } = await estimatedBacon();
  const res = await patch(bacon.id, { supplierId: real.id, packPrice: 520, priceEstimated: false, updatedBy: "Sedary" });
  expect(res.status).toBe(200);
  const after = await prisma.ingredient.findUnique({ where: { id: bacon.id } });
  expect(after?.priceEstimated).toBe(false);
  expect(after?.supplierId).toBe(real.id);
  expect(Number(after?.packPrice)).toBe(520);
});

test("updating the price without confirming leaves it flagged as an estimate", async () => {
  const { bacon } = await estimatedBacon();
  await patch(bacon.id, { packPrice: 450, updatedBy: "Sedary" });
  expect((await prisma.ingredient.findUnique({ where: { id: bacon.id } }))?.priceEstimated).toBe(true);
});

test("a price change recosts dishes that use the ingredient", async () => {
  const { bacon, real } = await estimatedBacon();
  const dish = await prisma.dish.create({ data: { name: "BLT", category: "Sandwich", createdBy: "S" } });
  await prisma.dishVersion.create({
    data: {
      dishId: dish.id, versionNumber: 1, costSnapshot: 40, sellingPrice: 160, createdBy: "S",
      lines: { create: [{ ingredientId: bacon.id, ingredientNameSnapshot: "Bacon", quantity: 100, unit: "G", lineCostSnapshot: 40 }] },
    },
  });
  await patch(bacon.id, { supplierId: real.id, packPrice: 600, priceEstimated: false, updatedBy: "Sedary" });

  const versions = await prisma.dishVersion.findMany({ where: { dishId: dish.id }, orderBy: { versionNumber: "asc" } });
  expect(versions).toHaveLength(2);
  expect(versions[1].source).toBe("AUTO_PRICE_REFRESH");
  expect(Number(versions[1].costSnapshot)).toBeCloseTo(60, 5); // 100 g at 600/1000
});

test("a price or supplier change adds a history row, an untouched edit does not", async () => {
  const { bacon, real } = await estimatedBacon();
  await patch(bacon.id, { name: "Streaky bacon", updatedBy: "Sedary" });
  expect(await prisma.ingredientPriceHistory.count({ where: { ingredientId: bacon.id } })).toBe(0);

  await patch(bacon.id, { packPrice: 450, updatedBy: "Sedary" });
  await patch(bacon.id, { supplierId: real.id, updatedBy: "Sedary" });
  const rows = await prisma.ingredientPriceHistory.findMany({ where: { ingredientId: bacon.id }, orderBy: { recordedAt: "asc" } });
  expect(rows.map((r) => [r.supplierName, Number(r.packPrice)])).toEqual([
    ["Placeholder / Estimated", 450],
    ["La Bottega", 450],
  ]);
});
