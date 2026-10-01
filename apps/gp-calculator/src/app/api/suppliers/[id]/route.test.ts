import { prisma } from "@/lib/db/prisma";
import { afterEach, expect, test } from "vitest";
import { PATCH } from "./route";
import { NextRequest } from "next/server";

afterEach(async () => {
  await prisma.ingredient.deleteMany();
  await prisma.supplier.deleteMany();
});

test("PATCH returns a clean 404 for a non-existent supplier", async () => {
  const req = new NextRequest("http://localhost/api/suppliers/does-not-exist", {
    method: "PATCH",
    body: JSON.stringify({ archived: true, updatedBy: "Sedary" }),
  });
  const res = await PATCH(req, { params: { id: "does-not-exist" } });
  expect(res.status).toBe(404);
  const body = await res.json();
  expect(body.error).toBe("Not found");
});

test("PATCH on a stale copy of a supplier is refused with a conflict", async () => {
  const supplier = await prisma.supplier.create({ data: { name: "Fresh Farms Co", createdBy: "S", updatedBy: "S" } });
  const opened = supplier.updatedAt.toISOString();
  const call = (body: object) =>
    PATCH(new NextRequest(`http://localhost/api/suppliers/${supplier.id}`, { method: "PATCH", body: JSON.stringify(body) }), { params: { id: supplier.id } });

  expect((await call({ contactInfo: "081", updatedBy: "A", expectedUpdatedAt: opened })).status).toBe(200);
  const stale = await call({ name: "Renamed", updatedBy: "B", expectedUpdatedAt: opened });
  expect(stale.status).toBe(409);
  expect((await prisma.supplier.findUnique({ where: { id: supplier.id } }))?.name).toBe("Fresh Farms Co");
});
