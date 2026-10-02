// @vitest-environment node
import { afterEach, expect, test } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { GET } from "./route";

afterEach(async () => {
  await prisma.batchRecipeLine.deleteMany();
  await prisma.batchRecipe.deleteMany();
  await prisma.ingredientPriceHistory.deleteMany();
  await prisma.ingredient.deleteMany();
  await prisma.supplier.deleteMany();
});

const call = (id: string) => GET(new NextRequest(`http://localhost/api/batch-recipes/${id}/gp-history`), { params: { id } });

test("returns the batch's cost history as chart points", async () => {
  const sup = await prisma.supplier.create({ data: { name: "House-Made", createdBy: "S", updatedBy: "S" } });
  const out = await prisma.ingredient.create({ data: { name: "Dough", category: "B", supplierId: sup.id, purchaseUnit: "G", packQuantity: 1000, packPrice: 100, createdBy: "S", updatedBy: "S" } });
  const batch = await prisma.batchRecipe.create({ data: { name: "Dough", category: "B", yieldQuantity: 1000, yieldUnit: "G", portionSize: 100, sellingPrice: 40, outputIngredientId: out.id, createdBy: "S", updatedBy: "S" } });
  for (const [price, day] of [[100, 1], [150, 2]] as const) {
    await prisma.ingredientPriceHistory.create({ data: { ingredientId: out.id, supplierName: "House-Made", purchaseUnit: "G", packQuantity: 1000, packPrice: price, yieldPct: 100, recordedBy: "S", recordedAt: new Date(Date.UTC(2026, 8, day)) } });
  }
  const res = await call(batch.id);
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.map((p: { cost: number }) => p.cost)).toEqual([10, 15]);
  expect(body[1].gpPct).toBe(62.5);
});

test("an unknown batch is a 404", async () => {
  const res = await call("nope");
  expect(res.status).toBe(404);
});
