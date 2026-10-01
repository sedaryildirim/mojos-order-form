import { prisma } from "@/lib/db/prisma";
import { afterEach, expect, test } from "vitest";
import { GET, POST } from "./route";
import { NextRequest } from "next/server";

afterEach(async () => {
  await prisma.ingredient.deleteMany();
  await prisma.supplier.deleteMany();
});

test("POST creates a supplier", async () => {
  const req = new NextRequest("http://localhost/api/suppliers", {
    method: "POST",
    body: JSON.stringify({ name: "Fresh Farms Co", createdBy: "Sedary" }),
  });
  const res = await POST(req);
  expect(res.status).toBe(201);
  const body = await res.json();
  expect(body.name).toBe("Fresh Farms Co");
});

test("POST rejects an invalid payload", async () => {
  const req = new NextRequest("http://localhost/api/suppliers", {
    method: "POST",
    body: JSON.stringify({ name: "", createdBy: "" }),
  });
  const res = await POST(req);
  expect(res.status).toBe(400);
});

test("GET excludes archived suppliers by default", async () => {
  const active = await prisma.supplier.create({ data: { name: "Active Co", createdBy: "S", updatedBy: "S" } });
  await prisma.supplier.create({ data: { name: "Archived Co", createdBy: "S", updatedBy: "S", archived: true } });

  const res = await GET(new NextRequest("http://localhost/api/suppliers"));
  const body = await res.json();
  expect(body.map((s: { id: string }) => s.id)).toEqual([active.id]);
});
