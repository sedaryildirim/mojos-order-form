// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";

const load = vi.fn();
vi.mock("@/lib/sync/order-sheet-rows", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/sync/order-sheet-rows")>()),
  loadOrderSheetText: (...args: unknown[]) => load(...args),
}));

import { POST } from "./route";

const SHEET = `const DATA = ${JSON.stringify({
  "makro-kaif": { categories: [{ name: "Vegetables", items: [{ id: "100", name: "Cauliflower White 1 kg", unit: "Kilogram", price: 85, par: null }] }] },
})};`;

const call = (body: unknown) =>
  POST(new NextRequest("http://localhost/api/sync/order-sheet", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }));

beforeEach(() => load.mockReset());
afterEach(async () => {
  await prisma.ingredientPriceHistory.deleteMany();
  await prisma.ingredient.deleteMany();
  await prisma.supplier.deleteMany();
});

test("a dry run reports what would happen and writes nothing", async () => {
  load.mockResolvedValue(SHEET);
  const res = await call({ apply: false });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.applied).toBe(false);
  expect(body.created).toHaveLength(1);
  expect(await prisma.ingredient.count()).toBe(0);
});

test("apply creates the ingredients", async () => {
  load.mockResolvedValue(SHEET);
  const res = await call({ apply: true });
  expect(res.status).toBe(200);
  expect((await res.json()).applied).toBe(true);
  expect(await prisma.ingredient.findUnique({ where: { sourceKey: "makro-kaif:100" } })).not.toBeNull();
});

test("an unreadable sheet is a 400 with a clear message and nothing changes", async () => {
  load.mockResolvedValue("<html>not found</html>");
  const res = await call({ apply: true });
  expect(res.status).toBe(400);
  expect((await res.json()).error).toMatch(/Could not read the order sheet/);
  expect(await prisma.ingredient.count()).toBe(0);
});

test("apply must be a true or false value", async () => {
  expect((await call({})).status).toBe(400);
  expect((await call({ apply: "yes" })).status).toBe(400);
});

test("only the configured sheet is ever downloaded, never an address from the request", async () => {
  load.mockResolvedValue(SHEET);
  await call({ apply: false, url: "http://evil.example/data.js", file: "/etc/passwd" });
  expect(load).toHaveBeenCalledTimes(1);
  expect(load).toHaveBeenCalledWith({ url: process.env.ORDER_SHEET_URL });
});
