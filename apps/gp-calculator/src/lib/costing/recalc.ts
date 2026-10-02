import { prisma } from "@/lib/db/prisma";
import { gpFromSellingPrice, lineCost } from "./costing";

export interface RecalcSummary {
  dishId: string;
  dishName: string;
  versionNumber: number;
  oldCost: number;
  newCost: number;
  sellingPrice: number | null;
  // fraction (0.75 = 75%); null when the dish has no selling price
  gpPct: number | null;
}

// Called after an ingredient price import: for every dish whose LATEST version
// uses one of the changed ingredients, creates a new DishVersion with the recipe
// lines recosted at current ingredient prices. Selling price, target GP%, notes
// and photo carry forward unchanged from the version it supersedes -- only the
// cost (and therefore GP) is recalculated. Never touches older versions; the
// immutable-cost-snapshot rule still holds for any version once it's not latest.
//
// A dish that cannot be recosted (a recipe line whose unit family no longer matches
// its ingredient's purchaseUnit) stays on its existing version -- a human has to fix
// the line by hand. Its name is pushed onto `skipped` so callers can say so.
// All new versions are written in one transaction.
export async function recalculateDishVersionsForIngredients(
  ingredientIds: string[],
  actorName: string,
  skipped: string[] = []
): Promise<RecalcSummary[]> {
  if (ingredientIds.length === 0) return [];
  const changedSet = new Set(ingredientIds);

  const dishes = await prisma.dish.findMany({
    include: {
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
        include: { lines: true },
      },
    },
  });

  const affected = dishes.filter((dish) => {
    const latest = dish.versions[0];
    return latest !== undefined && latest.lines.some((line) => changedSet.has(line.ingredientId));
  });
  if (affected.length === 0) return [];

  const usedIds = new Set(affected.flatMap((dish) => dish.versions[0].lines.map((line) => line.ingredientId)));
  const ingredients = await prisma.ingredient.findMany({ where: { id: { in: Array.from(usedIds) } } });
  const ingredientMap = new Map(ingredients.map((i) => [i.id, i]));

  const summaries: RecalcSummary[] = [];
  const creates: ReturnType<typeof prisma.dishVersion.create>[] = [];

  for (const dish of affected) {
    const latest = dish.versions[0];
    try {
      const lineData = latest.lines.map((line) => {
        const ingredient = ingredientMap.get(line.ingredientId);
        if (!ingredient) {
          throw new Error(`Ingredient ${line.ingredientId} no longer exists`);
        }
        const cost = lineCost(
          {
            purchaseUnit: ingredient.purchaseUnit,
            packQuantity: Number(ingredient.packQuantity),
            packPrice: Number(ingredient.packPrice),
            yieldPct: Number(ingredient.yieldPct),
          },
          Number(line.quantity),
          line.unit
        );
        return {
          ingredientId: ingredient.id,
          ingredientNameSnapshot: ingredient.name,
          quantity: Number(line.quantity),
          unit: line.unit,
          lineCostSnapshot: cost,
        };
      });

      const newCost = lineData.reduce((sum, l) => sum + l.lineCostSnapshot, 0);
      const sellingPrice = latest.sellingPrice ? Number(latest.sellingPrice) : null;

      creates.push(
        prisma.dishVersion.create({
          data: {
            dishId: dish.id,
            versionNumber: latest.versionNumber + 1,
            costSnapshot: newCost,
            sellingPrice: latest.sellingPrice,
            targetGpPct: latest.targetGpPct,
            notes: latest.notes,
            photoUrl: latest.photoUrl,
            source: "AUTO_PRICE_REFRESH",
            createdBy: actorName,
            lines: { create: lineData },
          },
        })
      );
      summaries.push({
        dishId: dish.id,
        dishName: dish.name,
        versionNumber: latest.versionNumber + 1,
        oldCost: Number(latest.costSnapshot),
        newCost,
        sellingPrice,
        gpPct: gpFromSellingPrice(newCost, sellingPrice)?.gpPct ?? null,
      });
    } catch {
      skipped.push(dish.name);
    }
  }

  if (creates.length > 0) await prisma.$transaction(creates);
  return summaries;
}
