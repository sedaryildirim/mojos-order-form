// @vitest-environment node
import { afterEach, expect, test } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "./route";
import { GET as GET_ONE, PATCH } from "./[id]/route";

afterEach(async () => {
  await prisma.batchRecipeLine.deleteMany();
  await prisma.batchRecipe.deleteMany();
  await prisma.dishVersion.deleteMany();
  await prisma.dish.deleteMany();
  await prisma.ingredient.deleteMany();
  await prisma.supplier.deleteMany();
});

async function flour() {
  const supplier = await prisma.supplier.create({ data: { name: "Makro", createdBy: "S", updatedBy: "S" } });
  return prisma.ingredient.create({
    data: { name: "Flour", category: "Dry", supplierId: supplier.id, purchaseUnit: "G", packQuantity: 1000, packPrice: 40, createdBy: "S", updatedBy: "S" },
  });
}

const post = (body: unknown) =>
  POST(new NextRequest("http://localhost/api/batch-recipes", { method: "POST", body: JSON.stringify(body) }));

test("POST creates a batch, publishes its ingredient, and GET reports cost per portion", async () => {
  const f = await flour();
  const res = await post({
    name: "Banana Bread", category: "Bakery", yieldQuantity: 8, yieldUnit: "EACH", createdBy: "Sedary",
    lines: [{ ingredientId: f.id, quantity: 400, unit: "G" }], // 16
  });
  expect(res.status).toBe(201);
  const body = await res.json();
  expect(body.totalCost).toBeCloseTo(16, 5);
  expect(body.costPerUnit).toBeCloseTo(2, 5);
  expect(body.outputIngredientId).toBeTruthy();

  const list = await (await GET()).json();
  expect(list).toHaveLength(1);
});

test("POST rejects a line whose unit doesn't match its ingredient with a 400", async () => {
  const f = await flour();
  const res = await post({
    name: "Bad", category: "Bakery", yieldQuantity: 1, yieldUnit: "EACH", createdBy: "S",
    lines: [{ ingredientId: f.id, quantity: 1, unit: "EACH" }],
  });
  expect(res.status).toBe(400);
});

test("PATCH that changes the cost creates an Updated version for dishes using the batch", async () => {
  const f = await flour();
  const created = await (await post({
    name: "Brioche Bun", category: "Bakery", yieldQuantity: 10, yieldUnit: "EACH", createdBy: "S",
    lines: [{ ingredientId: f.id, quantity: 500, unit: "G" }], // 20 -> 2 per bun
  })).json();
  const dish = await prisma.dish.create({ data: { name: "Burger", category: "Main", createdBy: "S" } });
  await prisma.dishVersion.create({
    data: {
      dishId: dish.id, versionNumber: 1, costSnapshot: 2, createdBy: "S",
      lines: { create: [{ ingredientId: created.outputIngredientId, ingredientNameSnapshot: "Brioche Bun", quantity: 1, unit: "EACH", lineCostSnapshot: 2 }] },
    },
  });

  const res = await PATCH(
    new NextRequest("http://localhost/api/batch-recipes/x", {
      method: "PATCH",
      body: JSON.stringify({
        name: "Brioche Bun", category: "Bakery", yieldQuantity: 10, yieldUnit: "EACH", createdBy: "S",
        lines: [{ ingredientId: f.id, quantity: 1000, unit: "G" }], // 40 -> 4 per bun
      }),
    }),
    { params: { id: created.id } }
  );
  expect(res.status).toBe(200);

  const versions = await prisma.dishVersion.findMany({ where: { dishId: dish.id }, orderBy: { versionNumber: "asc" } });
  expect(versions).toHaveLength(2);
  expect(versions[1].source).toBe("AUTO_PRICE_REFRESH");
  expect(Number(versions[1].costSnapshot)).toBeCloseTo(4, 5);
});

test("PATCH refuses to change the yield unit family when dishes already use the batch", async () => {
  const f = await flour();
  const created = await (await post({
    name: "Focaccia", category: "Bakery", yieldQuantity: 10, yieldUnit: "EACH", createdBy: "S",
    lines: [{ ingredientId: f.id, quantity: 500, unit: "G" }],
  })).json();
  const dish = await prisma.dish.create({ data: { name: "Sandwich", category: "Main", createdBy: "S" } });
  await prisma.dishVersion.create({
    data: {
      dishId: dish.id, versionNumber: 1, costSnapshot: 2, createdBy: "S",
      lines: { create: [{ ingredientId: created.outputIngredientId, ingredientNameSnapshot: "Focaccia", quantity: 1, unit: "EACH", lineCostSnapshot: 2 }] },
    },
  });
  const res = await PATCH(
    new NextRequest("http://localhost/api/batch-recipes/x", {
      method: "PATCH",
      body: JSON.stringify({ name: "Focaccia", category: "Bakery", yieldQuantity: 1000, yieldUnit: "G", createdBy: "S", lines: [{ ingredientId: f.id, quantity: 500, unit: "G" }] }),
    }),
    { params: { id: created.id } }
  );
  expect(res.status).toBe(400);
});

test("GET one batch marks lines whose price is still an estimate, and the list flags the batch", async () => {
  const f = await flour();
  const guess = await prisma.ingredient.create({
    data: { name: "Cocoa", category: "Dry", supplierId: f.supplierId, purchaseUnit: "G", packQuantity: 1000, packPrice: 250, priceEstimated: true, createdBy: "S", updatedBy: "S" },
  });
  const created = await (
    await post({
      name: "Brownie", category: "Bakery", yieldQuantity: 8, yieldUnit: "EACH", createdBy: "Sedary",
      lines: [{ ingredientId: f.id, quantity: 400, unit: "G" }, { ingredientId: guess.id, quantity: 50, unit: "G" }],
    })
  ).json();

  const one = await (await GET_ONE(new NextRequest("http://localhost/x"), { params: { id: created.id } })).json();
  const notes = Object.fromEntries(one.lines.map((l: { ingredient: { name: string }; estimateNote: string | null }) => [l.ingredient.name, l.estimateNote]));
  expect(notes).toEqual({ Flour: null, Cocoa: "Estimated price" });

  const list = await (await GET()).json();
  expect(list[0].attention).toEqual(["Cocoa"]);
});
