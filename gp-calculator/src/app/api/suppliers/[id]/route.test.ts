import { prisma } from "@/lib/prisma";
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
