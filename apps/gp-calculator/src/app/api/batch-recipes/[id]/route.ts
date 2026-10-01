import { prisma } from "@/lib/db/prisma";
import { batchRecipeInputSchema } from "@/lib/db/validation";
import { batchTotalCost, loadBatch, presentBatch, syncBatchOutput, syncBatchesForIngredients } from "@/lib/costing/batch";
import { estimateNote, findEstimatedIngredientIds } from "@/lib/costing/estimates";
import { recalculateDishVersionsForIngredients } from "@/lib/costing/recalc";
import { unitFamily } from "@/lib/costing/units";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const batch = await loadBatch(params.id);
  if (!batch) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const estimated = await findEstimatedIngredientIds();
  const presented = presentBatch(batch);
  return NextResponse.json({
    ...presented,
    lines: presented.lines.map((l) => ({ ...l, estimateNote: estimateNote(l.ingredient, estimated) })),
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const parsed = batchRecipeInputSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const existing = await prisma.batchRecipe.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { lines, createdBy: actor, ...fields } = parsed.data;

  if (existing.outputIngredientId && lines.some((l) => l.ingredientId === existing.outputIngredientId)) {
    return NextResponse.json({ error: "A batch recipe can't use itself as an ingredient" }, { status: 400 });
  }

  // Dishes already use the published ingredient in its old unit family; changing the
  // family (e.g. portions -> grams) would break those recipe lines.
  if (existing.outputIngredientId && unitFamily(existing.yieldUnit) !== unitFamily(fields.yieldUnit)) {
    const inUse = await prisma.versionIngredient.count({ where: { ingredientId: existing.outputIngredientId } });
    if (inUse > 0) {
      return NextResponse.json(
        { error: "Dishes already use this batch in its current unit, so the yield unit can't change" },
        { status: 400 }
      );
    }
  }

  const ingredients = await prisma.ingredient.findMany({ where: { id: { in: lines.map((l) => l.ingredientId) } } });
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  if (!lines.every((l) => byId.has(l.ingredientId))) {
    return NextResponse.json({ error: "One or more ingredients could not be found" }, { status: 400 });
  }
  try {
    batchTotalCost(lines.map((l) => ({ ...l, ingredient: byId.get(l.ingredientId)! })));
  } catch {
    return NextResponse.json({ error: "One or more lines use a unit that doesn't match their ingredient" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.batchRecipeLine.deleteMany({ where: { batchRecipeId: params.id } }),
    prisma.batchRecipe.update({
      where: { id: params.id },
      data: { ...fields, updatedBy: actor, lines: { create: lines } },
    }),
  ]);

  const changedOutput = await syncBatchOutput(params.id, actor);
  if (changedOutput) {
    const cascaded = await syncBatchesForIngredients([changedOutput], actor);
    await recalculateDishVersionsForIngredients([changedOutput, ...cascaded], actor);
  }
  return NextResponse.json(presentBatch((await loadBatch(params.id))!));
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const existing = await prisma.batchRecipe.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // The published ingredient is kept: dishes may reference it. Only the recipe is removed.
  await prisma.batchRecipe.delete({ where: { id: params.id } });
  return new NextResponse(null, { status: 204 });
}
