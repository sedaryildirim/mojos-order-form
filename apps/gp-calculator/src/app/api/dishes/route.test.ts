import { prisma } from "@/lib/db/prisma";
import { afterEach, expect, test } from "vitest";
import { GET, POST } from "./route";
import { NextRequest } from "next/server";

afterEach(async () => {
  await prisma.dishVersion.deleteMany();
  await prisma.dish.deleteMany();
});

test("POST creates a dish with no versions", async () => {
  const req = new NextRequest("http://localhost/api/dishes", {
    method: "POST",
    body: JSON.stringify({ name: "Onion Soup", category: "Starter", createdBy: "Sedary" }),
  });
  const res = await POST(req);
  expect(res.status).toBe(201);
  const body = await res.json();
  expect(body.name).toBe("Onion Soup");
});

test("GET lists dishes with their latest version summary", async () => {
  const dish = await prisma.dish.create({ data: { name: "Onion Soup", category: "Starter", createdBy: "S" } });
  await prisma.dishVersion.create({ data: { dishId: dish.id, versionNumber: 1, costSnapshot: 10, sellingPrice: 40, createdBy: "S" } });
  await prisma.dishVersion.create({ data: { dishId: dish.id, versionNumber: 2, costSnapshot: 12, sellingPrice: 45, createdBy: "S" } });

  const res = await GET();
  const body = await res.json();
  expect(body).toHaveLength(1);
  expect(body[0].versions[0].versionNumber).toBe(2); // newest first
});
