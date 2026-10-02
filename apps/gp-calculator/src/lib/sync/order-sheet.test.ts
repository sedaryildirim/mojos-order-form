import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { syncOrderSheet } from "./order-sheet";
import type { SheetRow } from "./order-sheet-rows";

afterEach(async () => {
  await prisma.batchRecipeLine.deleteMany();
  await prisma.batchRecipe.deleteMany();
  await prisma.dishVersion.deleteMany();
  await prisma.dish.deleteMany();
  await prisma.ingredientPriceHistory.deleteMany();
  await prisma.ingredient.deleteMany();
  await prisma.supplier.deleteMany();
});

const row = (over: Partial<SheetRow> = {}): SheetRow => ({
  sourceKey: "makro-kaif:100", name: "Cauliflower White 1 kg", category: "Vegetables", supplier: "Makro",
  purchaseUnit: "G", packQuantity: 1000, packPrice: 85, needsPackSize: false, ...over,
});
const apply = (rows: SheetRow[]) => syncOrderSheet(rows, { apply: true, actor: "Sync" });
const preview = (rows: SheetRow[]) => syncOrderSheet(rows, { apply: false, actor: "Sync" });

async function supplier(name = "Makro") {
  return prisma.supplier.create({ data: { name, createdBy: "S", updatedBy: "S" } });
}
async function ingredient(supplierId: string, over: Record<string, unknown> = {}) {
  return prisma.ingredient.create({
    data: { name: "Cauliflower White 1 kg", category: "Veg", supplierId, purchaseUnit: "G", packQuantity: 1000, packPrice: 79, createdBy: "S", updatedBy: "S", ...over },
  });
}
async function dishUsing(ingredientId: string) {
  const dish = await prisma.dish.create({ data: { name: "Salad", category: "Starter", createdBy: "S" } });
  await prisma.dishVersion.create({
    data: {
      dishId: dish.id, versionNumber: 1, costSnapshot: 7.9, sellingPrice: 100, createdBy: "S",
      lines: { create: [{ ingredientId, ingredientNameSnapshot: "Cauliflower", quantity: 100, unit: "G", lineCostSnapshot: 7.9 }] },
    },
  });
  return dish;
}

describe("syncOrderSheet", () => {
  it("creates a new ingredient with its sourceKey, creating the supplier and a price-history row", async () => {
    const r = await apply([row()]);
    expect(r.created).toEqual([{ name: "Cauliflower White 1 kg", supplier: "Makro" }]);
    const ing = await prisma.ingredient.findUniqueOrThrow({ where: { sourceKey: "makro-kaif:100" }, include: { supplier: true, priceHistory: true } });
    expect(ing.supplier.name).toBe("Makro");
    expect(Number(ing.packPrice)).toBe(85);
    expect(ing.priceHistory).toHaveLength(1);
  });

  it("adopts an existing same-name, same-supplier ingredient instead of duplicating it", async () => {
    const s = await supplier();
    const existing = await ingredient(s.id);
    await apply([row()]);
    expect(await prisma.ingredient.count()).toBe(1);
    const after = await prisma.ingredient.findUniqueOrThrow({ where: { id: existing.id } });
    expect(after.sourceKey).toBe("makro-kaif:100");
    expect(Number(after.packPrice)).toBe(85);
  });

  it("updates a renamed item in place, matched by sourceKey", async () => {
    await apply([row()]);
    await apply([row({ name: "Cauliflower White (new name)" })]);
    expect(await prisma.ingredient.count()).toBe(1);
    expect((await prisma.ingredient.findUniqueOrThrow({ where: { sourceKey: "makro-kaif:100" } })).name).toBe("Cauliflower White (new name)");
  });

  it("a price change records history and gives dishes that use it a new version at the new cost", async () => {
    const s = await supplier();
    const ing = await ingredient(s.id, { sourceKey: "makro-kaif:100" });
    const dish = await dishUsing(ing.id);
    const r = await apply([row({ packPrice: 100 })]);
    expect(r.priceChanged).toEqual([{ name: "Cauliflower White 1 kg", supplier: "Makro", oldPrice: 79, newPrice: 100 }]);
    const versions = await prisma.dishVersion.findMany({ where: { dishId: dish.id }, orderBy: { versionNumber: "asc" } });
    expect(versions).toHaveLength(2);
    expect(Number(versions[1].costSnapshot)).toBeCloseTo(10, 5);
    expect(versions[1].source).toBe("AUTO_PRICE_REFRESH");
    expect(await prisma.ingredientPriceHistory.count({ where: { ingredientId: ing.id } })).toBe(1);
  });

  it("running the same sheet twice changes nothing the second time", async () => {
    const s = await supplier();
    const ing = await ingredient(s.id, { sourceKey: "makro-kaif:100" });
    await dishUsing(ing.id);
    await apply([row({ packPrice: 100 })]);
    const versions = await prisma.dishVersion.count();
    const history = await prisma.ingredientPriceHistory.count();
    const again = await apply([row({ packPrice: 100 })]);
    expect(again.unchanged).toBe(1);
    expect(again.priceChanged).toEqual([]);
    expect(await prisma.dishVersion.count()).toBe(versions);
    expect(await prisma.ingredientPriceHistory.count()).toBe(history);
  });

  it("a dry run reports the same changes but writes nothing", async () => {
    const s = await supplier();
    const ing = await ingredient(s.id, { sourceKey: "makro-kaif:100" });
    await dishUsing(ing.id);
    const r = await preview([row({ packPrice: 100 }), row({ sourceKey: "makro-kaif:200", name: "Brand new" })]);
    expect(r.applied).toBe(false);
    expect(r.priceChanged).toHaveLength(1);
    expect(r.created).toHaveLength(1);
    expect(r.dishes).toHaveLength(1);
    expect(await prisma.ingredient.count()).toBe(1);
    expect(Number((await prisma.ingredient.findUniqueOrThrow({ where: { id: ing.id } })).packPrice)).toBe(79);
    expect(await prisma.dishVersion.count()).toBe(1);
  });

  it("removes a synced item that left the sheet when nothing uses it", async () => {
    const s = await supplier();
    const gone = await ingredient(s.id, { sourceKey: "makro-kaif:999", name: "Discontinued" });
    await prisma.ingredientPriceHistory.create({ data: { ingredientId: gone.id, supplierName: "Makro", purchaseUnit: "G", packQuantity: 1000, packPrice: 5, yieldPct: 100, recordedBy: "S" } });
    const r = await apply([row()]);
    expect(r.removed).toEqual([{ name: "Discontinued", supplier: "Makro" }]);
    expect(await prisma.ingredient.findUnique({ where: { id: gone.id } })).toBeNull();
  });

  it("archives, never deletes, a removed item that a dish still uses", async () => {
    const s = await supplier();
    const used = await ingredient(s.id, { sourceKey: "makro-kaif:999", name: "Discontinued but used" });
    await dishUsing(used.id);
    const r = await apply([row()]);
    expect(r.archivedBecauseUsed).toEqual([{ name: "Discontinued but used", supplier: "Makro" }]);
    expect(r.removed).toEqual([]);
    expect((await prisma.ingredient.findUniqueOrThrow({ where: { id: used.id } })).archived).toBe(true);
  });

  it("never removes a batch output ingredient", async () => {
    const s = await supplier("House-Made");
    const out = await ingredient(s.id, { sourceKey: "makro-kaif:777", name: "Dressing" });
    await prisma.batchRecipe.create({ data: { name: "Dressing", category: "Sauce", yieldQuantity: 500, yieldUnit: "G", outputIngredientId: out.id, createdBy: "S", updatedBy: "S" } });
    const r = await apply([row()]);
    expect(r.removed).toEqual([]);
    expect(r.archivedBecauseUsed).toEqual([]);
    expect(await prisma.ingredient.findUnique({ where: { id: out.id } })).not.toBeNull();
  });

  it("lists items whose pack size could not be read", async () => {
    const r = await apply([row({ sourceKey: "makro-kaif:300", name: "ARO Toilet Tissue 48 rolls", purchaseUnit: "EACH", packQuantity: 1, needsPackSize: true })]);
    expect(r.needsPackSize).toEqual([{ name: "ARO Toilet Tissue 48 rolls", supplier: "Makro" }]);
  });

  it("refuses an empty sheet, so a bad download can never remove everything", async () => {
    const s = await supplier();
    await ingredient(s.id, { sourceKey: "makro-kaif:100" });
    await expect(apply([])).rejects.toThrow(/no items/i);
    expect(await prisma.ingredient.count()).toBe(1);
  });

  it("keeps an existing ingredient's own pack and scales the sheet price into it", async () => {
    const s = await supplier();
    // The GP buys this in 500 g packs at 40; the sheet sells a 1 kg pack at 90, so 500 g costs 45.
    const ing = await ingredient(s.id, { packQuantity: 500, packPrice: 40 });
    const r = await apply([row({ packQuantity: 1000, packPrice: 90 })]);
    const after = await prisma.ingredient.findUniqueOrThrow({ where: { id: ing.id } });
    expect(Number(after.packQuantity)).toBe(500);
    expect(Number(after.packPrice)).toBe(45);
    expect(after.sourceKey).toBe("makro-kaif:100");
    expect(r.priceChanged).toEqual([{ name: "Cauliflower White 1 kg", supplier: "Makro", oldPrice: 40, newPrice: 45 }]);
  });

  it("an existing ingredient in an incompatible unit is linked but left untouched, and reported", async () => {
    const s = await supplier();
    const ing = await ingredient(s.id, { name: "Big Tofu", packQuantity: 400, packPrice: 15 });
    const r = await apply([row({ sourceKey: "phangangreenveg:55", name: "Big Tofu", purchaseUnit: "EACH", packQuantity: 1, packPrice: 18 })]);
    const after = await prisma.ingredient.findUniqueOrThrow({ where: { id: ing.id } });
    expect(after.purchaseUnit).toBe("G");
    expect(Number(after.packPrice)).toBe(15);
    expect(after.sourceKey).toBe("phangangreenveg:55");
    expect(r.packMismatch).toEqual([{ name: "Big Tofu", supplier: "Makro", gpPack: "400 G", sheetPack: "1 EACH", sheetPrice: 18 }]);
    expect(r.priceChanged).toEqual([]);
  });

  it("treats grams and millilitres as interchangeable, as the GP already does for liquids", async () => {
    const s = await supplier();
    const ing = await ingredient(s.id, { name: "Yoghurt 1.8 l", packQuantity: 1800, packPrice: 175 });
    const r = await apply([row({ sourceKey: "makro-kaif:56", name: "Yoghurt 1.8 l", purchaseUnit: "ML", packQuantity: 1800, packPrice: 190 })]);
    const after = await prisma.ingredient.findUniqueOrThrow({ where: { id: ing.id } });
    expect(after.purchaseUnit).toBe("G");
    expect(Number(after.packQuantity)).toBe(1800);
    expect(Number(after.packPrice)).toBe(190);
    expect(r.packMismatch).toEqual([]);
    expect(r.priceChanged).toHaveLength(1);
  });

  it("only new ingredients are listed as needing a pack size", async () => {
    const s = await supplier();
    await ingredient(s.id, { name: "Lemon", packQuantity: 1000, packPrice: 60 });
    const r = await apply([
      row({ sourceKey: "fruitshop:1", name: "Lemon", purchaseUnit: "EACH", packQuantity: 1, packPrice: 60, needsPackSize: true }),
      row({ sourceKey: "fruitshop:2", name: "Coconut", purchaseUnit: "EACH", packQuantity: 1, packPrice: 30, needsPackSize: true }),
    ]);
    expect(r.needsPackSize.map((x) => x.name)).toEqual(["Coconut"]);
  });
});
