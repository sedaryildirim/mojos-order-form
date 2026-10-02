import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { batchGpHistory, dishGpHistory, loadBatchGpHistory, loadDishGpHistory, MAX_UPDATES } from "./gp-history";

const day = (n: number) => new Date(Date.UTC(2026, 8, n, 9, 0, 0));
const version = (n: number, cost: number, price: number | null, source: "MANUAL" | "AUTO_PRICE_REFRESH" = "AUTO_PRICE_REFRESH") => ({
  id: `v${n}`, versionNumber: n, createdAt: day(n), costSnapshot: cost, sellingPrice: price, source,
});

describe("dishGpHistory", () => {
  it("turns each version into a point: GP% = (price - cost) / price", () => {
    const pts = dishGpHistory([version(1, 25, 100, "MANUAL"), version(2, 30, 100)]);
    expect(pts).toHaveLength(2);
    expect(pts[0]).toMatchObject({ label: "v1", cost: 25, sellingPrice: 100, gpPct: 75, reason: "Recipe created" });
    expect(pts[1]).toMatchObject({ label: "v2", cost: 30, gpPct: 70, reason: "Ingredient prices updated" });
  });

  it("keeps only the last 6 updates, oldest first, and still knows the first version was the creation", () => {
    const all = Array.from({ length: 9 }, (_, i) => version(i + 1, 20 + i, 100, i === 0 ? "MANUAL" : "AUTO_PRICE_REFRESH"));
    const pts = dishGpHistory(all);
    expect(MAX_UPDATES).toBe(6);
    expect(pts.map((p) => p.label)).toEqual(["v4", "v5", "v6", "v7", "v8", "v9"]);
    expect(pts.every((p) => p.reason !== "Recipe created")).toBe(true);
  });

  it("sorts by version number whatever order they arrive in", () => {
    expect(dishGpHistory([version(3, 30, 100), version(1, 10, 100, "MANUAL"), version(2, 20, 100)]).map((p) => p.label)).toEqual(["v1", "v2", "v3"]);
  });

  it("a version without a menu price has no GP, only a cost", () => {
    const [p] = dishGpHistory([version(1, 40, null, "MANUAL")]);
    expect(p.gpPct).toBeNull();
    expect(p.cost).toBe(40);
  });

  it("a manual edit after the first version is labelled as an edit", () => {
    expect(dishGpHistory([version(1, 10, 100, "MANUAL"), version(2, 12, 100, "MANUAL")])[1].reason).toBe("Recipe edited");
  });
});

describe("batchGpHistory", () => {
  const entry = (n: number, packPrice: number, packQuantity = 1800, purchaseUnit: "G" | "ML" | "EACH" = "G") => ({ id: `h${n}`, recordedAt: day(n), packPrice, packQuantity, purchaseUnit });

  it("costs one portion (pack price / portions) and measures GP against the batch's menu price", () => {
    const pts = batchGpHistory([entry(1, 180), entry(2, 270)], { portionSize: 200, sellingPrice: 120 });
    // 1800 g / 200 g = 9 portions
    expect(pts[0]).toMatchObject({ cost: 20, gpPct: (100 / 120) * 100, reason: "Batch created" });
    expect(pts[1]).toMatchObject({ cost: 30, gpPct: 75, reason: "Ingredient prices changed" });
  });

  it("without a menu price the points carry cost only", () => {
    const pts = batchGpHistory([entry(1, 180)], { portionSize: 200, sellingPrice: null });
    expect(pts[0].gpPct).toBeNull();
    expect(pts[0].cost).toBe(20);
  });

  it("without a portion size the whole batch is one portion", () => {
    expect(batchGpHistory([entry(1, 180)], { portionSize: null, sellingPrice: null })[0].cost).toBe(180);
  });

  it("a batch counted in pieces uses the pieces as portions", () => {
    expect(batchGpHistory([entry(1, 100, 10, "EACH")], { portionSize: null, sellingPrice: null })[0].cost).toBe(10);
  });

  it("skips history rows where nothing about the cost changed, and keeps the last 6", () => {
    const rows = [entry(1, 100), entry(2, 100), entry(3, 110), entry(4, 110), entry(5, 120), entry(6, 130), entry(7, 140), entry(8, 150), entry(9, 160)];
    const pts = batchGpHistory(rows, { portionSize: null, sellingPrice: null });
    expect(pts.map((p) => p.cost)).toEqual([110, 120, 130, 140, 150, 160]);
  });
});

afterEach(async () => {
  await prisma.batchRecipeLine.deleteMany();
  await prisma.batchRecipe.deleteMany();
  await prisma.dishVersion.deleteMany();
  await prisma.dish.deleteMany();
  await prisma.ingredientPriceHistory.deleteMany();
  await prisma.ingredient.deleteMany();
  await prisma.supplier.deleteMany();
});

describe("loaders", () => {
  it("loadDishGpHistory reads a dish's versions from the database", async () => {
    const dish = await prisma.dish.create({ data: { name: "Salad", category: "X", createdBy: "S" } });
    for (const [n, cost] of [[1, 20], [2, 25]] as const) {
      await prisma.dishVersion.create({ data: { dishId: dish.id, versionNumber: n, costSnapshot: cost, sellingPrice: 100, createdBy: "S", source: n === 1 ? "MANUAL" : "AUTO_PRICE_REFRESH" } });
    }
    const pts = await loadDishGpHistory(dish.id);
    expect(pts.map((p) => p.gpPct)).toEqual([80, 75]);
  });

  it("loadBatchGpHistory reads the batch's published ingredient history, and is empty before it is published", async () => {
    const sup = await prisma.supplier.create({ data: { name: "House-Made", createdBy: "S", updatedBy: "S" } });
    const out = await prisma.ingredient.create({ data: { name: "Dough", category: "B", supplierId: sup.id, purchaseUnit: "G", packQuantity: 1000, packPrice: 100, createdBy: "S", updatedBy: "S" } });
    const batch = await prisma.batchRecipe.create({ data: { name: "Dough", category: "B", yieldQuantity: 1000, yieldUnit: "G", portionSize: 100, sellingPrice: 40, outputIngredientId: out.id, createdBy: "S", updatedBy: "S" } });
    await prisma.ingredientPriceHistory.create({ data: { ingredientId: out.id, supplierName: "House-Made", purchaseUnit: "G", packQuantity: 1000, packPrice: 100, yieldPct: 100, recordedBy: "S", recordedAt: day(1) } });
    await prisma.ingredientPriceHistory.create({ data: { ingredientId: out.id, supplierName: "House-Made", purchaseUnit: "G", packQuantity: 1000, packPrice: 150, yieldPct: 100, recordedBy: "S", recordedAt: day(2) } });
    const pts = await loadBatchGpHistory(batch.id);
    expect(pts.map((p) => p.cost)).toEqual([10, 15]);
    expect(pts[1].gpPct).toBe(62.5);

    const draft = await prisma.batchRecipe.create({ data: { name: "Draft", category: "B", yieldQuantity: 500, yieldUnit: "G", createdBy: "S", updatedBy: "S" } });
    expect(await loadBatchGpHistory(draft.id)).toEqual([]);
  });
});
