import * as XLSX from "xlsx";
import { afterEach, expect, test } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { NextRequest } from "next/server";
import { GET } from "./route";

const request = (query = "") => new NextRequest(`http://localhost/api/ingredients/export${query}`);

afterEach(async () => {
  await prisma.ingredient.deleteMany();
  await prisma.supplier.deleteMany();
});

test("GET returns an xlsx workbook of active ingredients, excluding archived ones", async () => {
  const supplier = await prisma.supplier.create({ data: { name: "Fresh Farms Co", createdBy: "S", updatedBy: "S" } });
  await prisma.ingredient.create({
    data: { name: "Onions", category: "Veg", supplierId: supplier.id, purchaseUnit: "G", packQuantity: 5000, packPrice: 200, createdBy: "S", updatedBy: "S" },
  });
  await prisma.ingredient.create({
    data: { name: "Old Stock", category: "Veg", supplierId: supplier.id, purchaseUnit: "G", packQuantity: 100, packPrice: 10, archived: true, createdBy: "S", updatedBy: "S" },
  });

  const res = await GET(request());
  expect(res.status).toBe(200);
  expect(res.headers.get("Content-Disposition")).toContain("kaif-ingredients-template");

  const buffer = Buffer.from(await res.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });

  const flat = rows.map((r) => r.join(",")).join("\n");
  expect(flat).toContain("Onions");
  expect(flat).not.toContain("Old Stock");
});

test("GET with supplierId returns only that supplier's ingredients", async () => {
  const a = await prisma.supplier.create({ data: { name: "Supplier A", createdBy: "S", updatedBy: "S" } });
  const b = await prisma.supplier.create({ data: { name: "Supplier B", createdBy: "S", updatedBy: "S" } });
  const base = { category: "Veg", purchaseUnit: "G" as const, packQuantity: 1000, packPrice: 50, createdBy: "S", updatedBy: "S" };
  await prisma.ingredient.create({ data: { ...base, name: "From A", supplierId: a.id } });
  await prisma.ingredient.create({ data: { ...base, name: "From B", supplierId: b.id } });

  const res = await GET(request(`?supplierId=${a.id}`));
  const workbook = XLSX.read(Buffer.from(await res.arrayBuffer()), { type: "buffer" });
  const flat = XLSX.utils
    .sheet_to_json<string[]>(workbook.Sheets[workbook.SheetNames[0]], { header: 1 })
    .map((r) => r.join(","))
    .join("\n");
  expect(flat).toContain("From A");
  expect(flat).not.toContain("From B");
});
