import { prisma } from "@/lib/prisma";
import { afterEach, expect, test } from "vitest";
import { POST } from "./route";
import { NextRequest } from "next/server";

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
  return { onions, dish };
}

test("POST computes and stores a cost snapshot for the version and its lines", async () => {
  const { onions, dish } = await setup();
  const req = new NextRequest(`http://localhost/api/dishes/${dish.id}/versions`, {
    method: "POST",
    body: JSON.stringify({
      sellingPrice: 40, createdBy: "Sedary",
      lines: [{ ingredientId: onions.id, quantity: 250, unit: "G" }],
    }),
  });
  const res = await POST(req, { params: { id: dish.id } });
  expect(res.status).toBe(201);
  const body = await res.json();
  expect(Number(body.costSnapshot)).toBeCloseTo(10, 5); // 250g * (200/5000)
  expect(body.versionNumber).toBe(1);
  expect(Number(body.lines[0].lineCostSnapshot)).toBeCloseTo(10, 5);
});

test("a later version's cost is unaffected by a subsequent ingredient price change", async () => {
  const { onions, dish } = await setup();
  const firstReq = new NextRequest(`http://localhost/api/dishes/${dish.id}/versions`, {
    method: "POST",
    body: JSON.stringify({ createdBy: "Sedary", lines: [{ ingredientId: onions.id, quantity: 250, unit: "G" }] }),
  });
  const firstVersion = await (await POST(firstReq, { params: { id: dish.id } })).json();

  await prisma.ingredient.update({ where: { id: onions.id }, data: { packPrice: 400 } }); // price doubles

  const refetched = await prisma.dishVersion.findUnique({ where: { id: firstVersion.id } });
  expect(Number(refetched?.costSnapshot)).toBeCloseTo(10, 5); // unchanged
});

test("POST succeeds when the same ingredient is used across two lines", async () => {
  const { onions, dish } = await setup();
  const req = new NextRequest(`http://localhost/api/dishes/${dish.id}/versions`, {
    method: "POST",
    body: JSON.stringify({
      createdBy: "Sedary",
      lines: [
        { ingredientId: onions.id, quantity: 100, unit: "G" },
        { ingredientId: onions.id, quantity: 150, unit: "G" },
      ],
    }),
  });
  const res = await POST(req, { params: { id: dish.id } });
  expect(res.status).toBe(201);
  const body = await res.json();
  expect(body.lines).toHaveLength(2);
});

test("POST with a line unit outside the ingredient's unit family returns 400, not a 500", async () => {
  const supplier = await prisma.supplier.create({ data: { name: "Fresh Farms Co", createdBy: "S", updatedBy: "S" } });
  const eggs = await prisma.ingredient.create({
    data: { name: "Eggs", category: "Dairy", supplierId: supplier.id, purchaseUnit: "EACH", packQuantity: 12, packPrice: 90, createdBy: "S", updatedBy: "S" },
  });
  const dish = await prisma.dish.create({ data: { name: "Omelette", category: "Main", createdBy: "S" } });

  const req = new NextRequest(`http://localhost/api/dishes/${dish.id}/versions`, {
    method: "POST",
    body: JSON.stringify({
      createdBy: "Sedary",
      // Eggs are purchased EACH (count family); "G" is weight — incompatible.
      lines: [{ ingredientId: eggs.id, quantity: 100, unit: "G" }],
    }),
  });
  const res = await POST(req, { params: { id: dish.id } });
  expect(res.status).toBe(400);
  const body = await res.json();
  expect(body.error).toMatch(/unit/i);
});

test("POST to a nonexistent dish returns 404, not a 500", async () => {
  const { onions } = await setup();
  const req = new NextRequest("http://localhost/api/dishes/does-not-exist/versions", {
    method: "POST",
    body: JSON.stringify({
      createdBy: "Sedary",
      lines: [{ ingredientId: onions.id, quantity: 250, unit: "G" }],
    }),
  });
  const res = await POST(req, { params: { id: "does-not-exist" } });
  expect(res.status).toBe(404);
});
