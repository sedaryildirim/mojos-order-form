import { prisma } from "@/lib/db/prisma";
import { afterEach, expect, test } from "vitest";
import { GET, POST } from "./route";
import { NextRequest } from "next/server";

afterEach(async () => {
  await prisma.ingredient.deleteMany();
  await prisma.supplier.deleteMany();
});

async function makeSupplier() {
  return prisma.supplier.create({ data: { name: "Fresh Farms Co", createdBy: "S", updatedBy: "S" } });
}

test("POST creates an ingredient", async () => {
  const supplier = await makeSupplier();
  const req = new NextRequest("http://localhost/api/ingredients", {
    method: "POST",
    body: JSON.stringify({
      name: "Onions", category: "Veg", supplierId: supplier.id,
      purchaseUnit: "G", packQuantity: 5000, packPrice: 200, yieldPct: 100,
      createdBy: "Sedary",
    }),
  });
  const res = await POST(req);
  expect(res.status).toBe(201);
});

test("GET filters by supplierId and category", async () => {
  const supplier = await makeSupplier();
  await prisma.ingredient.create({
    data: { name: "Onions", category: "Veg", supplierId: supplier.id, purchaseUnit: "G", packQuantity: 5000, packPrice: 200, createdBy: "S", updatedBy: "S" },
  });
  await prisma.ingredient.create({
    data: { name: "Milk", category: "Dairy", supplierId: supplier.id, purchaseUnit: "ML", packQuantity: 1000, packPrice: 45, createdBy: "S", updatedBy: "S" },
  });

  const req = new NextRequest(`http://localhost/api/ingredients?supplierId=${supplier.id}&category=Veg`);
  const res = await GET(req);
  const body = await res.json();
  expect(body).toHaveLength(1);
  expect(body[0].name).toBe("Onions");
});

test("POST under the placeholder supplier is marked as an estimated price", async () => {
  const placeholder = await prisma.supplier.create({ data: { name: "Placeholder / Estimated", createdBy: "S", updatedBy: "S" } });
  const real = await makeSupplier();
  const create = async (name: string, supplierId: string) => {
    const res = await POST(
      new NextRequest("http://localhost/api/ingredients", {
        method: "POST",
        body: JSON.stringify({ name, category: "Veg", supplierId, purchaseUnit: "G", packQuantity: 1000, packPrice: 50, yieldPct: 100, createdBy: "Sedary" }),
      })
    );
    return res.json();
  };
  expect((await create("Guess", placeholder.id)).priceEstimated).toBe(true);
  expect((await create("Known", real.id)).priceEstimated).toBe(false);
});
