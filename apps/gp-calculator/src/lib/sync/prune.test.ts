import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { pruneUnmanagedIngredients } from "./prune";

afterEach(async () => {
  await prisma.batchRecipeLine.deleteMany();
  await prisma.batchRecipe.deleteMany();
  await prisma.dishVersion.deleteMany();
  await prisma.dish.deleteMany();
  await prisma.ingredientPriceHistory.deleteMany();
  await prisma.ingredient.deleteMany();
  await prisma.supplier.deleteMany();
});

async function setup() {
  const sup = await prisma.supplier.create({ data: { name: "Makro", createdBy: "S", updatedBy: "S" } });
  const make = (name: string, extra: Record<string, unknown> = {}) =>
    prisma.ingredient.create({
      data: { name, category: "Veg", supplierId: sup.id, purchaseUnit: "G", packQuantity: 1000, packPrice: 50, createdBy: "S", updatedBy: "S", ...extra },
    });
  return { sup, make };
}
async function dishWithVersions(lines: { v1?: string[]; v2?: string[] }) {
  const dish = await prisma.dish.create({ data: { name: "Salad", category: "Starter", createdBy: "S" } });
  for (const [n, ids] of [[1, lines.v1 ?? []], [2, lines.v2 ?? []]] as [number, string[]][]) {
    await prisma.dishVersion.create({
      data: {
        dishId: dish.id, versionNumber: n, costSnapshot: 1, createdBy: "S",
        lines: { create: ids.map((id) => ({ ingredientId: id, ingredientNameSnapshot: "x", quantity: 1, unit: "G", lineCostSnapshot: 1 })) },
      },
    });
  }
}

describe("pruneUnmanagedIngredients", () => {
  it("deletes an unmanaged ingredient that nothing uses, with its price history", async () => {
    const { make } = await setup();
    const loose = await make("Loose");
    await prisma.ingredientPriceHistory.create({ data: { ingredientId: loose.id, supplierName: "Makro", purchaseUnit: "G", packQuantity: 1000, packPrice: 50, yieldPct: 100, recordedBy: "S" } });
    const r = await pruneUnmanagedIngredients({ apply: true, actor: "T" });
    expect(r.deleted.map((x) => x.name)).toEqual(["Loose"]);
    expect(await prisma.ingredient.findUnique({ where: { id: loose.id } })).toBeNull();
  });

  it("archives one that only older dish versions use, and keeps one the current version uses", async () => {
    const { make } = await setup();
    const old = await make("OnlyOld");
    const current = await make("Current");
    await dishWithVersions({ v1: [old.id, current.id], v2: [current.id] });
    const r = await pruneUnmanagedIngredients({ apply: true, actor: "T" });
    expect(r.archived.map((x) => x.name)).toEqual(["OnlyOld"]);
    expect(r.kept.map((x) => x.name)).toEqual(["Current"]);
    expect((await prisma.ingredient.findUniqueOrThrow({ where: { id: old.id } })).archived).toBe(true);
    expect((await prisma.ingredient.findUniqueOrThrow({ where: { id: current.id } })).archived).toBe(false);
  });

  it("keeps one that a batch recipe line uses", async () => {
    const { make } = await setup();
    const flour = await make("Flour");
    const out = await make("Dough");
    await prisma.batchRecipe.create({
      data: { name: "Dough", category: "Bakery", yieldQuantity: 1000, yieldUnit: "G", outputIngredientId: out.id, createdBy: "S", updatedBy: "S", lines: { create: [{ ingredientId: flour.id, quantity: 500, unit: "G" }] } },
    });
    const r = await pruneUnmanagedIngredients({ apply: true, actor: "T" });
    expect(r.kept.map((x) => x.name)).toEqual(["Flour"]);
    expect(await prisma.ingredient.count()).toBe(2);
  });

  it("never touches a batch output or an ingredient linked to the order sheet", async () => {
    const { make } = await setup();
    const out = await make("Dough");
    await make("Synced", { sourceKey: "makro-kaif:1" });
    await prisma.batchRecipe.create({ data: { name: "Dough", category: "Bakery", yieldQuantity: 1000, yieldUnit: "G", outputIngredientId: out.id, createdBy: "S", updatedBy: "S" } });
    const r = await pruneUnmanagedIngredients({ apply: true, actor: "T" });
    expect(r.deleted).toEqual([]);
    expect(r.archived).toEqual([]);
    expect(await prisma.ingredient.count()).toBe(2);
  });

  it("a dry run reports the same sets and changes nothing", async () => {
    const { make } = await setup();
    const loose = await make("Loose");
    const r = await pruneUnmanagedIngredients({ apply: false, actor: "T" });
    expect(r.applied).toBe(false);
    expect(r.deleted.map((x) => x.name)).toEqual(["Loose"]);
    expect(await prisma.ingredient.findUnique({ where: { id: loose.id } })).not.toBeNull();
  });
});
