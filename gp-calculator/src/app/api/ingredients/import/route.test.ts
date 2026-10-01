// @vitest-environment node
import { prisma } from "@/lib/prisma";
import { afterEach, expect, test } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

afterEach(async () => {
  await prisma.dishVersion.deleteMany();
  await prisma.dish.deleteMany();
  await prisma.ingredient.deleteMany();
  await prisma.supplier.deleteMany();
});

function importRequest(csv: string, createdBy = "Sedary") {
  const formData = new FormData();
  formData.append("file", new File([csv], "import.csv", { type: "text/csv" }));
  formData.append("createdBy", createdBy);
  return new NextRequest("http://localhost/api/ingredients/import", { method: "POST", body: formData });
}

test("a price change auto-updates the affected dish's cost and reports it as recalculatedDishes", async () => {
  const supplier = await prisma.supplier.create({ data: { name: "Fresh Farms Co", createdBy: "S", updatedBy: "S" } });
  const onions = await prisma.ingredient.create({
    data: { name: "Onions", category: "Veg", supplierId: supplier.id, purchaseUnit: "G", packQuantity: 5000, packPrice: 200, createdBy: "S", updatedBy: "S" },
  });
  const dish = await prisma.dish.create({ data: { name: "Onion Soup", category: "Starter", createdBy: "S" } });
  await prisma.dishVersion.create({
    data: {
      dishId: dish.id,
      versionNumber: 1,
      costSnapshot: 10,
      sellingPrice: 40,
      createdBy: "S",
      lines: { create: [{ ingredientId: onions.id, ingredientNameSnapshot: "Onions", quantity: 250, unit: "G", lineCostSnapshot: 10 }] },
    },
  });

  const csv = "name,category,supplier,purchaseUnit,packQuantity,packPrice,yieldPct\nOnions,Veg,Fresh Farms Co,G,5000,400,100";
  const res = await POST(importRequest(csv));
  expect(res.status).toBe(200);
  const body = await res.json();

  expect(body.updated).toBe(1);
  expect(body.recalculatedDishes).toEqual([{ dishId: dish.id, dishName: "Onion Soup", versionNumber: 2, oldCost: 10, newCost: 20, sellingPrice: 40, gpPct: 0.5 }]);

  const versions = await prisma.dishVersion.findMany({ where: { dishId: dish.id }, orderBy: { versionNumber: "asc" } });
  expect(versions).toHaveLength(2);
  expect(versions[1].source).toBe("AUTO_PRICE_REFRESH");
  expect(Number(versions[1].costSnapshot)).toBe(20);
});

test("re-uploading identical prices reports no recalculated dishes", async () => {
  const supplier = await prisma.supplier.create({ data: { name: "Fresh Farms Co", createdBy: "S", updatedBy: "S" } });
  await prisma.ingredient.create({
    data: { name: "Onions", category: "Veg", supplierId: supplier.id, purchaseUnit: "G", packQuantity: 5000, packPrice: 200, createdBy: "S", updatedBy: "S" },
  });

  const csv = "name,category,supplier,purchaseUnit,packQuantity,packPrice,yieldPct\nOnions,Veg,Fresh Farms Co,G,5000,200,100";
  const res = await POST(importRequest(csv));
  const body = await res.json();

  expect(body.updated).toBe(1);
  expect(body.recalculatedDishes).toEqual([]);
});
