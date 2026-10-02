import { prisma } from "@/lib/db/prisma";

export const NO_RECIPE = "No recipe yet";

// Ingredients whose price can't be trusted yet: anything still marked as an estimated price,
// plus batch outputs built (directly or through other batches) from such ingredients
// or from a batch that has no ingredients yet.
export async function findEstimatedIngredientIds(): Promise<Set<string>> {
  const estimated = new Set(
    (await prisma.ingredient.findMany({ where: { priceEstimated: true }, select: { id: true } })).map((i) => i.id)
  );

  const batches = await prisma.batchRecipe.findMany({
    where: { outputIngredientId: { not: null } },
    select: { outputIngredientId: true, lines: { select: { ingredientId: true } } },
  });
  for (const b of batches) if (b.lines.length === 0) estimated.add(b.outputIngredientId!);

  // a batch can use another batch's output, so repeat until nothing new is flagged
  for (let round = 0; round < 6; round++) {
    let added = false;
    for (const b of batches) {
      if (estimated.has(b.outputIngredientId!)) continue;
      if (b.lines.some((l) => estimated.has(l.ingredientId))) {
        estimated.add(b.outputIngredientId!);
        added = true;
      }
    }
    if (!added) break;
  }
  return estimated;
}

// For each dish that needs attention: the reasons (names of estimated ingredients in its
// latest recipe, or NO_RECIPE when it has none). Dishes that are fully priced are absent.
export function dishAttention(
  dishes: { id: string; versions: { lines: { ingredientId: string; ingredientNameSnapshot: string }[] }[] }[],
  estimated: Set<string>
): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const d of dishes) {
    const latest = d.versions[0];
    if (!latest || latest.lines.length === 0) {
      result.set(d.id, [NO_RECIPE]);
      continue;
    }
    const names = Array.from(
      new Set(latest.lines.filter((l) => estimated.has(l.ingredientId)).map((l) => l.ingredientNameSnapshot))
    );
    if (names.length > 0) result.set(d.id, names);
  }
  return result;
}

const NO_INGREDIENTS = "No ingredients yet";

// Same idea for batch recipes: the estimated ingredients among their lines (which includes
// other batches that are themselves estimated), or NO_INGREDIENTS for an empty draft.
export function batchAttention(
  batches: { id: string; lines: { ingredientId: string; ingredient: { name: string } }[] }[],
  estimated: Set<string>
): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const b of batches) {
    if (b.lines.length === 0) {
      result.set(b.id, [NO_INGREDIENTS]);
      continue;
    }
    const names = Array.from(new Set(b.lines.filter((l) => estimated.has(l.ingredientId)).map((l) => l.ingredient.name)));
    if (names.length > 0) result.set(b.id, names);
  }
  return result;
}

const ESTIMATED_PRICE = "Price is a guess";
const BATCH_ESTIMATED = "Batch uses guessed prices";

// Why an ingredient's price can't be trusted yet, or null when it's a real price.
export function estimateNote(ingredient: { id: string; priceEstimated: boolean }, estimated: Set<string>): string | null {
  if (ingredient.priceEstimated) return ESTIMATED_PRICE;
  if (estimated.has(ingredient.id)) return BATCH_ESTIMATED;
  return null;
}

export { isPlaceholderSupplier } from "./estimates-shared";
