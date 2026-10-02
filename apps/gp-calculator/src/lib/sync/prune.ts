import { prisma } from "@/lib/db/prisma";

export interface PruneReport {
  applied: boolean;
  // Used by nothing: removed, together with their price history.
  deleted: { name: string; supplier: string }[];
  // Only older dish versions mention them: hidden, so history stays readable.
  archived: { name: string; supplier: string }[];
  // A current dish or a batch recipe uses them: left exactly as they are.
  kept: { name: string; supplier: string }[];
}

// One-time cleanup after the first order-sheet sync. Looks only at ingredients that are NOT linked to the order sheet
// (no sourceKey) and are not a batch recipe's output. Anything a current recipe needs is never touched.
export async function pruneUnmanagedIngredients(opts: { apply: boolean; actor: string }): Promise<PruneReport> {
  const report: PruneReport = { applied: opts.apply, deleted: [], archived: [], kept: [] };

  // The latest version of each dish is its "current" recipe.
  const dishes = await prisma.dish.findMany({ select: { versions: { orderBy: { versionNumber: "desc" }, take: 1, select: { id: true } } } });
  const currentVersionIds = dishes.flatMap((d) => d.versions.map((v) => v.id));

  const candidates = await prisma.ingredient.findMany({
    where: { sourceKey: null, archived: false, batchOutput: { is: null } },
    include: { supplier: { select: { name: true } } },
    orderBy: [{ supplier: { name: "asc" } }, { name: "asc" }],
  });

  for (const ing of candidates) {
    const entry = { name: ing.name, supplier: ing.supplier.name };
    const [inCurrent, inAnyDish, inBatch] = await Promise.all([
      prisma.versionIngredient.count({ where: { ingredientId: ing.id, dishVersionId: { in: currentVersionIds } } }),
      prisma.versionIngredient.count({ where: { ingredientId: ing.id } }),
      prisma.batchRecipeLine.count({ where: { ingredientId: ing.id } }),
    ]);
    if (inCurrent + inBatch > 0) {
      report.kept.push(entry);
    } else if (inAnyDish > 0) {
      report.archived.push(entry);
      if (opts.apply) await prisma.ingredient.update({ where: { id: ing.id }, data: { archived: true, updatedBy: opts.actor } });
    } else {
      report.deleted.push(entry);
      if (opts.apply) {
        await prisma.$transaction([
          prisma.ingredientPriceHistory.deleteMany({ where: { ingredientId: ing.id } }),
          prisma.ingredient.delete({ where: { id: ing.id } }),
        ]);
      }
    }
  }
  return report;
}
