import { prisma } from "@/lib/db/prisma";
import { SpecSheet } from "@/components/dishes/SpecSheet";
import { PhotoUpload } from "@/components/ui/PhotoUpload";
import { EmailShareForm } from "@/components/ui/EmailShareForm";
import { formatTHB } from "@/lib/costing/currency";
import { gpFromSellingPrice, roundUpToMenuPrice, suggestedPriceFromTargetGp, TARGET_GP_PCT } from "@/lib/costing/costing";
import Link from "next/link";
import { notFound } from "next/navigation";
import { findEstimatedIngredientIds } from "@/lib/costing/estimates";
import { loadDishGpHistory } from "@/lib/costing/gp-history";
import { GpHistoryChart } from "@/components/charts/GpHistoryChart";

export const dynamic = "force-dynamic";
import type { SpecSheetVersion } from "@/components/dishes/SpecSheet";

export async function generateMetadata({ params }: { params: { versionId: string } }) {
  const version = await prisma.dishVersion.findUnique({ where: { id: params.versionId }, select: { dish: { select: { name: true } } } });
  return { title: version?.dish.name ?? "Dish" };
}

export default async function DishVersionPage({ params }: { params: { versionId: string } }) {
  const version = await prisma.dishVersion.findUnique({
    where: { id: params.versionId },
    include: { lines: true, dish: true },
  });
  if (!version) notFound();

  // Lines that are house-made batches, so the cost can be traced back to their recipes.
  const batchOutputs = await prisma.batchRecipe.findMany({
    where: { outputIngredientId: { in: version.lines.map((l) => l.ingredientId) } },
    select: { id: true, name: true, outputIngredientId: true },
  });
  const batchByIngredient = new Map(batchOutputs.map((b) => [b.outputIngredientId, b]));
  const houseMadeLines = version.lines.filter((l) => batchByIngredient.has(l.ingredientId));
  const estimatedIds = await findEstimatedIngredientIds();
  const flags: Record<string, string> = {};
  const lineIngredients = await prisma.ingredient.findMany({
    where: { id: { in: version.lines.map((l) => l.ingredientId) } },
    include: { supplier: { select: { name: true } } },
  });
  for (const ing of lineIngredients) {
    if (!estimatedIds.has(ing.id)) continue;
    flags[ing.id] = ing.priceEstimated
      ? "Price is a guess"
      : batchByIngredient.has(ing.id)
        ? "Batch has estimated prices"
        : "Check price";
  }
  const flaggedCount = new Set(version.lines.filter((l) => flags[l.ingredientId]).map((l) => l.ingredientId)).size;
  const totalCost = Number(version.costSnapshot);
  const sellingPrice = version.sellingPrice ? Number(version.sellingPrice) : null;
  const gp = gpFromSellingPrice(totalCost, sellingPrice);
  const targetPrice = totalCost > 0 ? roundUpToMenuPrice(suggestedPriceFromTargetGp(totalCost, TARGET_GP_PCT)) : null;
  const belowTarget = gp !== null && gp.gpPct * 100 < TARGET_GP_PCT && targetPrice !== null;
  const houseMadeCost = houseMadeLines.reduce((sum, l) => sum + Number(l.lineCostSnapshot), 0);

  const previousVersion = await prisma.dishVersion.findFirst({
    where: { dishId: version.dishId, versionNumber: { lt: version.versionNumber } },
    orderBy: { versionNumber: "desc" },
    select: { id: true },
  });

  const gpHistory = await loadDishGpHistory(version.dishId);

  const notices = (
    <>
      {flaggedCount > 0 && (
        <div role="alert">
          <p>Has guessed prices</p>
          <p>
            {flaggedCount} ingredient{flaggedCount === 1 ? "" : "s"} below {flaggedCount === 1 ? "uses" : "use"} a
            guessed price, so this dish&apos;s cost and GP are approximate. {flaggedCount === 1 ? "It is" : "They are"} tagged &quot;Price is a guess&quot;.
          </p>
        </div>
      )}
      {belowTarget && sellingPrice !== null && targetPrice !== null && (
        <div>
          <p>
            GP is {((gp?.gpPct ?? 0) * 100).toFixed(1)}%, below your {TARGET_GP_PCT}% target
          </p>
          <p>
            Raise the price from {formatTHB(sellingPrice)} to {formatTHB(targetPrice)} (+{formatTHB(targetPrice - sellingPrice)}), or
            bring the cost down to {formatTHB(sellingPrice * (1 - TARGET_GP_PCT / 100))}. The biggest cost line is in bold below.
          </p>
        </div>
      )}
      {sellingPrice === null && targetPrice !== null && (
        <div>
          No menu price set. For {TARGET_GP_PCT}% GP, price it at {formatTHB(targetPrice)}.
        </div>
      )}
    </>
  );

  const actions = (
  <div data-actions>
    <Link href={`/dishes/${version.dishId}/versions/new?amendFrom=${version.id}`}>Edit recipe</Link>
    <details data-menu>
      <summary>Export and share</summary>
      <div>
        <a href={`/api/dish-versions/${version.id}/pdf`}>PDF</a>
        <a href={`/api/dish-versions/${version.id}/xlsx`}>Excel</a>
        <a href={`/share/${version.shareToken}`}>Share link</a>
      </div>
    </details>
    {previousVersion && (
      <Link href={`/dishes/${version.dishId}/compare?a=${previousVersion.id}&b=${version.id}`}>
        Compare with last version
      </Link>
    )}
    {version.source === "AUTO_PRICE_REFRESH" && (
      <span title="Cost recalculated automatically after a supplier price changed">Cost updated</span>
    )}
  </div>
  );

  return (
    <main>
      <Link href="/dishes">
        ← All dishes
      </Link>
      <div>
        <SpecSheet
          version={version as unknown as SpecSheetVersion}
          flags={flags}
          showVersion={false}
          showShare
          summary="top"
          beforeTable={notices}
          actions={actions}
          lineHref={(ingredientId) => {
            const batch = batchByIngredient.get(ingredientId);
            return batch
              ? `/batch-recipes/${batch.id}`
              : `/ingredients/${ingredientId}?from=${encodeURIComponent(`/dishes/${version.dishId}/versions/${version.id}`)}`;
          }}
        />
      </div>
      {houseMadeLines.length > 0 && (
        <section>
          <h2>House-made components</h2>
          <p>
            {formatTHB(houseMadeCost)} of this dish&apos;s {formatTHB(totalCost)} cost
            {totalCost > 0 ? ` (${Math.round((houseMadeCost / totalCost) * 100)}%)` : ""} comes from batch recipes.
          </p>
          <ul>
            {houseMadeLines.map((l) => {
              const batch = batchByIngredient.get(l.ingredientId)!;
              return (
                <li key={l.id}>
                  <Link href={`/batch-recipes/${batch.id}`}>
                    {batch.name}
                  </Link>
                  <span>{formatTHB(Number(l.lineCostSnapshot))}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <GpHistoryChart points={gpHistory} />
      <details>
        <summary>Photo and email</summary>
        <PhotoUpload versionId={version.id} />
        <EmailShareForm versionId={version.id} />
      </details>
    </main>
  );
}
