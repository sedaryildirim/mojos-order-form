import { prisma } from "@/lib/db/prisma";
import { afterEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/io/email", () => ({ sendSpecSheetEmail: vi.fn().mockResolvedValue(undefined) }));

import { POST } from "./route";
import { sendSpecSheetEmail } from "@/lib/io/email";

afterEach(async () => {
  await prisma.dishVersion.deleteMany();
  await prisma.dish.deleteMany();
});

test("rejects a malformed email address before sending", async () => {
  const dish = await prisma.dish.create({ data: { name: "Onion Soup", category: "Starter", createdBy: "S" } });
  const version = await prisma.dishVersion.create({ data: { dishId: dish.id, versionNumber: 1, costSnapshot: 10, createdBy: "S" } });

  const req = new NextRequest(`http://localhost/api/dish-versions/${version.id}/email`, {
    method: "POST",
    body: JSON.stringify({ to: "not-an-email" }),
  });
  const res = await POST(req, { params: { id: version.id } });

  expect(res.status).toBe(400);
  expect(sendSpecSheetEmail).not.toHaveBeenCalled();
});

test("sends the email for a valid address", async () => {
  const dish = await prisma.dish.create({ data: { name: "Onion Soup", category: "Starter", createdBy: "S" } });
  const version = await prisma.dishVersion.create({ data: { dishId: dish.id, versionNumber: 1, costSnapshot: 10, createdBy: "S" } });

  const req = new NextRequest(`http://localhost/api/dish-versions/${version.id}/email`, {
    method: "POST",
    body: JSON.stringify({ to: "chef@example.com" }),
  });
  const res = await POST(req, { params: { id: version.id } });

  expect(res.status).toBe(200);
  expect(sendSpecSheetEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "chef@example.com", dishName: "Onion Soup" }));
});
