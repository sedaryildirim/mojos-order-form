import { prisma } from "@/lib/db/prisma";
import { afterEach, expect, test } from "vitest";
import ComparePage from "./page";

afterEach(async () => {
  await prisma.dishVersion.deleteMany();
  await prisma.dish.deleteMany();
});

test("calls notFound() when a version id belongs to a different dish than the URL's dish id", async () => {
  const dishA = await prisma.dish.create({ data: { name: "Onion Soup", category: "Starter", createdBy: "S" } });
  const dishB = await prisma.dish.create({ data: { name: "Tom Yum", category: "Starter", createdBy: "S" } });

  const versionA = await prisma.dishVersion.create({ data: { dishId: dishA.id, versionNumber: 1, costSnapshot: 10, createdBy: "S" } });
  const versionB = await prisma.dishVersion.create({ data: { dishId: dishB.id, versionNumber: 1, costSnapshot: 20, createdBy: "S" } });

  // Passing dishB's version id in a compare URL for dishA should be a clean
  // not-found, not a nonsensical cross-dish diff.
  await expect(
    ComparePage({ params: { id: dishA.id }, searchParams: { a: versionA.id, b: versionB.id } })
  ).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK|NEXT_NOT_FOUND/);
});

test("renders the diff when both versions belong to the dish in the URL", async () => {
  const dish = await prisma.dish.create({ data: { name: "Onion Soup", category: "Starter", createdBy: "S" } });
  const v1 = await prisma.dishVersion.create({ data: { dishId: dish.id, versionNumber: 1, costSnapshot: 10, createdBy: "S" } });
  const v2 = await prisma.dishVersion.create({ data: { dishId: dish.id, versionNumber: 2, costSnapshot: 20, createdBy: "S" } });

  const result = await ComparePage({ params: { id: dish.id }, searchParams: { a: v1.id, b: v2.id } });
  expect(result).toBeTruthy();
});
