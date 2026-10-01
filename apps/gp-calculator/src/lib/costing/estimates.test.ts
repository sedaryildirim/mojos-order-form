import { afterEach, expect, test } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { estimateNote, batchAttention, dishAttention, findEstimatedIngredientIds, NO_RECIPE } from "./estimates";

afterEach(async () => {
  await prisma.batchRecipeLine.deleteMany();
  await prisma.batchRecipe.deleteMany();
  await prisma.dishVersion.deleteMany();
  await prisma.dish.deleteMany();
  await prisma.ingredient.deleteMany();
  await prisma.supplier.deleteMany();
});

async function ingredient(name: string, supplierName: string) {
  const estimatedPrice = supplierName.startsWith("Placeholder");
  const supplier =
    (await prisma.supplier.findFirst({ where: { name: supplierName } })) ??
    (await prisma.supplier.create({ data: { name: supplierName, createdBy: "S", updatedBy: "S" } }));
  return prisma.ingredient.create({
    data: { name, category: "X", supplierId: supplier.id, purchaseUnit: "G", packQuantity: 1000, packPrice: 100, priceEstimated: estimatedPrice, createdBy: "S", updatedBy: "S" },
  });
}

test("placeholder ingredients, and batches built from them, are estimated", async () => {
  const real = await ingredient("Flour", "Makro");
  const guess = await ingredient("Bacon", "Placeholder / Estimated");
  const bread = await ingredient("Bread", "House-Made");
  const toast = await ingredient("Toast", "House-Made");
  await prisma.batchRecipe.create({
    data: { name: "Bread", category: "Bakery", yieldQuantity: 1, yieldUnit: "EACH", outputIngredientId: bread.id, createdBy: "S", updatedBy: "S",
      lines: { create: [{ ingredientId: real.id, quantity: 100, unit: "G" }, { ingredientId: guess.id, quantity: 10, unit: "G" }] } },
  });
  // built only from another batch, so it inherits the estimate
  await prisma.batchRecipe.create({
    data: { name: "Toast", category: "Bakery", yieldQuantity: 1, yieldUnit: "EACH", outputIngredientId: toast.id, createdBy: "S", updatedBy: "S",
      lines: { create: [{ ingredientId: bread.id, quantity: 1, unit: "EACH" }] } },
  });

  const ids = await findEstimatedIngredientIds();
  expect(ids.has(guess.id)).toBe(true);
  expect(ids.has(bread.id)).toBe(true);
  expect(ids.has(toast.id)).toBe(true);
  expect(ids.has(real.id)).toBe(false);
});

test("a batch with no ingredients yet counts as estimated", async () => {
  const shell = await ingredient("Sourdough", "House-Made");
  await prisma.batchRecipe.create({
    data: { name: "Sourdough", category: "Bakery", yieldQuantity: 1, yieldUnit: "EACH", outputIngredientId: shell.id, createdBy: "S", updatedBy: "S" },
  });
  expect((await findEstimatedIngredientIds()).has(shell.id)).toBe(true);
});

test("dishAttention lists estimated ingredients and dishes with no recipe, and skips clean dishes", () => {
  const estimated = new Set(["b"]);
  const line = (ingredientId: string, ingredientNameSnapshot: string) => ({ ingredientId, ingredientNameSnapshot });
  const result = dishAttention(
    [
      { id: "clean", versions: [{ lines: [line("a", "Flour")] }] },
      { id: "guessy", versions: [{ lines: [line("a", "Flour"), line("b", "Bacon"), line("b", "Bacon")] }] },
      { id: "empty", versions: [] },
    ],
    estimated
  );
  expect(result.has("clean")).toBe(false);
  expect(result.get("guessy")).toEqual(["Bacon"]);
  expect(result.get("empty")).toEqual([NO_RECIPE]);
});

test("batchAttention lists estimated lines and flags empty drafts", () => {
  const line = (ingredientId: string, name: string) => ({ ingredientId, ingredient: { name } });
  const result = batchAttention(
    [
      { id: "ok", lines: [line("a", "Flour")] },
      { id: "guessy", lines: [line("a", "Flour"), line("b", "Bread Flour")] },
      { id: "draft", lines: [] },
    ],
    new Set(["b"])
  );
  expect(result.has("ok")).toBe(false);
  expect(result.get("guessy")).toEqual(["Bread Flour"]);
  expect(result.get("draft")).toEqual(["No ingredients yet"]);
});

test("estimateNote distinguishes placeholder prices, estimated batches and real prices", () => {
  const estimated = new Set(["batch"]);
  expect(estimateNote({ id: "x", priceEstimated: true }, estimated)).toBe("Price is a guess");
  expect(estimateNote({ id: "batch", priceEstimated: false }, estimated)).toBe("Batch uses guessed prices");
  expect(estimateNote({ id: "y", priceEstimated: false }, estimated)).toBeNull();
});
