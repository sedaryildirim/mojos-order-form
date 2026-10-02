import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { parseFoodBible } from "./food-bible-parse";
import { BibleMap, importFoodBible, OldData } from "./food-bible-import";

afterEach(async () => {
  await prisma.batchRecipeLine.deleteMany();
  await prisma.batchRecipe.deleteMany();
  await prisma.dishVersion.deleteMany();
  await prisma.dish.deleteMany();
  await prisma.ingredientPriceHistory.deleteMany();
  await prisma.ingredient.deleteMany();
  await prisma.supplier.deleteMany();
});

const OLD: OldData = {
  dishes: [{ name: "Eggs Deluxe", category: "Breakfast", sellingPrice: 280, photoUrl: "https://example.test/p.jpg" }],
  batches: [{ name: "Banana Bread", category: "Bakery" }],
  ingredients: [{ name: "Hollandaise", purchaseUnit: "G", packQuantity: 500, packPrice: 100 }],
};
const OLD_TYPOS: OldData = {
  ...OLD,
  dishes: [
    { name: "Harrisa Chicken", category: "Sandwiches", sellingPrice: 290, photoUrl: null },
    { name: "Home Made Fries", category: "Sides", sellingPrice: 120, photoUrl: null },
  ],
};

async function ing(supplier: string, name: string, unit: "G" | "ML" | "EACH", pack: number, price: number) {
  const s = (await prisma.supplier.findFirst({ where: { name: supplier } })) ?? (await prisma.supplier.create({ data: { name: supplier, createdBy: "S", updatedBy: "S" } }));
  return prisma.ingredient.create({ data: { name, category: "Test", supplierId: s.id, purchaseUnit: unit, packQuantity: pack, packPrice: price, createdBy: "S", updatedBy: "S" } });
}
async function basics() {
  await ing("Makro", "Butter", "G", 1000, 200); // 0.2 per g
  await ing("Makro", "Egg", "EACH", 10, 50); // 5 per egg
  await ing("Makro", "Oil", "ML", 1000, 100); // 0.1 per ml
  await ing("Makro", "Flour", "G", 1000, 40);
  await ing("La Bottega", "Salmon", "G", 1000, 900); // 0.9 per g
  await ing("La Bottega", "Ham", "G", 1000, 600); // 0.6 per g
  await ing("Phangan Green Vegetables", "Pepper", "G", 1000, 100);
  await ing("Phangan Green Vegetables", "Carrot", "G", 1000, 50);
}
const MAP: BibleMap = {
  butter: { ingredient: "Makro|Butter" }, egg: { ingredient: "Makro|Egg" }, eggs: { ingredient: "Makro|Egg" },
  oil: { ingredient: "Makro|Oil" }, flour: { ingredient: "Makro|Flour" }, salmon: { ingredient: "La Bottega|Salmon" },
  "paris ham": { ingredient: "La Bottega|Ham" }, "bell pepper": { ingredient: "Phangan Green Vegetables|Pepper" },
  carrot: { ingredient: "Phangan Green Vegetables|Carrot" }, water: { skip: true },
  hollandaise: { placeholder: { name: "Hollandaise" } }, "mystery sauce": { placeholder: { name: "Mystery Sauce" } },
  bread: { batch: "BANANA BREAD" }, bun: { batch: "BAKED BUN", perPiece: { quantity: 100, unit: "G" } },
  mix: { mix: [{ ingredient: "Makro|Butter", share: 0.5 }, { ingredient: "Makro|Flour", share: 0.5 }] },
};
const run = (text: string, apply = true, old: OldData = OLD) => importFoodBible(parseFoodBible(text), { apply, actor: "T", map: MAP, old });
const doc = (body: string) => `KAIF FOOD BIBLE - TEST\n=====\n\n---------------------------------------\nBREAKFAST\n---------------------------------------\n\n${body}\n`;

describe("importFoodBible: batches", () => {
  it("creates a batch with its yield and portion, and publishes it as an ingredient priced at its cost", async () => {
    await basics();
    await run(doc("BANANA BREAD [BATCH]\nYield: 9 portions x 200g\n- 240g butter\n- 460g flour\n- 4 eggs\n- 100g water"));
    const b = await prisma.batchRecipe.findFirstOrThrow({ where: { name: "Banana Bread" }, include: { lines: true } });
    expect(Number(b.yieldQuantity)).toBe(1800);
    expect(Number(b.portionSize)).toBe(200);
    expect(b.category).toBe("Bakery"); // from the old data
    expect(b.lines).toHaveLength(3); // water is not costed
    const out = await prisma.ingredient.findUniqueOrThrow({ where: { id: b.outputIngredientId! } });
    expect(Number(out.packPrice)).toBeCloseTo(240 * 0.2 + 460 * 0.04 + 4 * 5, 5);
    expect(Number(out.packQuantity)).toBe(1800);
  });

  it("when the yield is not stated it uses the weight of the ingredients, and a stated portion size is kept", async () => {
    await basics();
    await run(doc("BAKED BUN [BATCH]\nYield: rolled into 120g balls (number of buns not stated)\n- 300g flour\n- 100g butter"));
    const b = await prisma.batchRecipe.findFirstOrThrow({ where: { name: "Baked Bun" } });
    expect(Number(b.yieldQuantity)).toBe(400);
    expect(Number(b.portionSize)).toBe(120);
  });
});

describe("importFoodBible: dishes", () => {
  it("costs a dish from its lines and carries over name, category, price and photo from the old data", async () => {
    await basics();
    await run(doc("EGGS DELUXE\n- 2 eggs\n- 40g hollandaise\n- 60g paris ham (Plain) OR 60g salmon (Fancy)"));
    const d = await prisma.dish.findFirstOrThrow({ where: { name: "Eggs Deluxe" }, include: { versions: { include: { lines: true } } } });
    expect(d.category).toBe("Breakfast");
    const v = d.versions[0];
    expect(Number(v.sellingPrice)).toBe(280);
    expect(v.photoUrl).toBe("https://example.test/p.jpg");
    // dearest option = salmon (0.9/g), hollandaise = old 100 per 500 g
    expect(v.lines.map((l) => l.ingredientNameSnapshot).sort()).toEqual(["Egg", "Hollandaise", "Salmon"]);
    expect(Number(v.costSnapshot)).toBeCloseTo(2 * 5 + 40 * 0.2 + 60 * 0.9, 5);
  });

  it("a comma list uses the stated weight of each item, and preparation words are ignored", async () => {
    await basics();
    await run(doc("SALAD\n- 30g bell pepper, carrot\n- 1 egg, poached"));
    const v = (await prisma.dishVersion.findFirstOrThrow({ where: { dish: { name: "Salad" } }, include: { lines: true } }));
    expect(v.lines).toHaveLength(3);
    expect(Number(v.costSnapshot)).toBeCloseTo(30 * 0.1 + 30 * 0.05 + 5, 5);
  });

  it("uses millilitres for a litre-sold ingredient when the bible gives grams, and 1 L as 1000 ml", async () => {
    await basics();
    await run(doc("DRESSED\n- 15g oil"));
    const l = await prisma.versionIngredient.findFirstOrThrow({ where: { ingredientNameSnapshot: "Oil" } });
    expect(l.unit).toBe("ML");
    expect(Number(l.lineCostSnapshot)).toBeCloseTo(1.5, 5);
  });

  it("an optional line is left out, and a named variant dish includes it", async () => {
    await basics();
    const text = doc("CAESAR SALAD\n- 40g carrot\n- 150g salmon (optional)");
    await importFoodBible(parseFoodBible(text), { apply: true, actor: "T", map: MAP, old: OLD, optionalVariants: { "CAESAR SALAD": "Chicken Caesar Salad" } });
    const base = await prisma.dishVersion.findFirstOrThrow({ where: { dish: { name: "Caesar Salad" } }, include: { lines: true } });
    const variant = await prisma.dishVersion.findFirstOrThrow({ where: { dish: { name: "Chicken Caesar Salad" } }, include: { lines: true } });
    expect(base.lines).toHaveLength(1);
    expect(variant.lines).toHaveLength(2);
    expect(Number(variant.costSnapshot)).toBeCloseTo(40 * 0.05 + 150 * 0.9, 5);
  });

  it("a bun counts as its batch's piece weight, and a dish can use a batch from the same document", async () => {
    await basics();
    await run(doc("BAKED BUN [BATCH]\nYield: rolled into 100g balls (number of buns not stated)\n- 500g flour\n\nBURGER\n- 1 bun\n- 20g butter"));
    const v = await prisma.dishVersion.findFirstOrThrow({ where: { dish: { name: "Burger" } }, include: { lines: true } });
    const bun = v.lines.find((l) => l.ingredientNameSnapshot === "Baked Bun")!;
    expect(Number(bun.quantity)).toBe(100);
    expect(bun.unit).toBe("G");
    expect(Number(bun.lineCostSnapshot)).toBeCloseTo(100 * (500 * 0.04) / 500, 5);
  });

  it("a mix splits its weight between its parts by share", async () => {
    await basics();
    await run(doc("BOWL\n- 100g mix"));
    const v = await prisma.dishVersion.findFirstOrThrow({ where: { dish: { name: "Bowl" } }, include: { lines: true } });
    expect(v.lines).toHaveLength(2);
    expect(v.lines.every((l) => Number(l.quantity) === 50)).toBe(true);
  });

  it("an ingredient with no match becomes a flagged estimate, priced from the old data when it had a price", async () => {
    await basics();
    await run(doc("PLATE\n- 40g hollandaise\n- 10g mystery sauce"));
    const est = await prisma.ingredient.findMany({ where: { priceEstimated: true }, include: { supplier: true }, orderBy: { name: "asc" } });
    expect(est.map((e) => e.name)).toEqual(["Hollandaise", "Mystery Sauce"]);
    expect(est.every((e) => e.supplier.name === "Placeholder / Estimated")).toBe(true);
    expect(Number(est[0].packPrice)).toBe(100);
    expect(Number(est[1].packPrice)).toBe(0);
  });
});

describe("importFoodBible: names", () => {
  it("finds an old dish whose spelling differs slightly, keeping its price and category but the bible's spelling", async () => {
    await basics();
    await run(doc("HARISSA CHICKEN\n- 40g carrot\n\nHOMEMADE FRIES\n- 40g carrot"), true, OLD_TYPOS);
    const a = await prisma.dish.findFirstOrThrow({ where: { name: "Harissa Chicken" }, include: { versions: true } });
    expect(a.category).toBe("Sandwiches");
    expect(Number(a.versions[0].sellingPrice)).toBe(290);
    const b = await prisma.dish.findFirstOrThrow({ where: { name: "Homemade Fries" }, include: { versions: true } });
    expect(Number(b.versions[0].sellingPrice)).toBe(120);
  });

  it("does not match a different dish that merely starts the same way", async () => {
    await basics();
    const old: OldData = { ...OLD, dishes: [{ name: "Caesar Salad With Chicken", category: "Salads", sellingPrice: 300, photoUrl: null }] };
    await run(doc("CAESAR SALAD\n- 40g carrot"), true, old);
    const d = await prisma.dish.findFirstOrThrow({ where: { name: "Caesar Salad" }, include: { versions: true } });
    expect(d.versions[0].sellingPrice).toBeNull();
  });
});

describe("importFoodBible: old prices", () => {
  it("treats an old price under 1 baht a pack as missing rather than a real price", async () => {
    await basics();
    const old: OldData = { ...OLD, ingredients: [{ name: "Mystery Sauce", purchaseUnit: "G", packQuantity: 500, packPrice: 0.01 }] };
    const r = await run(doc("PLATE\n- 10g mystery sauce"), false, old);
    expect(r.estimates).toEqual([{ name: "Mystery Sauce", packQuantity: 1000, purchaseUnit: "G", packPrice: 0, fromOldData: false }]);
  });
});

describe("importFoodBible: safety", () => {
  it("refuses to run when the database already has dishes or batches", async () => {
    await basics();
    await prisma.dish.create({ data: { name: "Existing", category: "X", createdBy: "S" } });
    await expect(run(doc("PLATE\n- 40g carrot"))).rejects.toThrow(/already has dishes/i);
  });

  it("a dry run reports what would be created and writes nothing", async () => {
    await basics();
    const r = await run(doc("PLATE\n- 40g carrot\n- 10g mystery sauce\n- 40g hollandaise"), false);
    expect(r.applied).toBe(false);
    expect(r.dishes).toHaveLength(1);
    expect(r.placeholders).toContain("Mystery Sauce");
    expect(r.estimates).toContainEqual({ name: "Mystery Sauce", packQuantity: 1000, purchaseUnit: "G", packPrice: 0, fromOldData: false });
    expect(r.estimates).toContainEqual({ name: "Hollandaise", packQuantity: 500, purchaseUnit: "G", packPrice: 100, fromOldData: true });
    expect(await prisma.dish.count()).toBe(0);
    expect(await prisma.ingredient.count()).toBe(8);
  });

  it("stops with a clear message when a mapped ingredient does not exist", async () => {
    await expect(run(doc("PLATE\n- 40g carrot"))).rejects.toThrow(/Phangan Green Vegetables\|Carrot/);
    expect(await prisma.dish.count()).toBe(0);
  });

  it("stops when a line has no mapping at all", async () => {
    await basics();
    await expect(run(doc("PLATE\n- 40g unicorn dust"))).rejects.toThrow(/unicorn dust/);
  });
});
