import { prisma } from "@/lib/prisma";
import { batchRecipeInputSchema } from "@/lib/validation";
import { batchTotalCost, loadBatch, presentBatch, syncBatchOutput } from "@/lib/batch";
import { batchAttention, findEstimatedIngredientIds } from "@/lib/estimates";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const batches = await prisma.batchRecipe.findMany({ orderBy: { name: "asc" }, select: { id: true } });
  const full = await Promise.all(batches.map((b) => loadBatch(b.id)));
  const loaded = full.filter((b) => b !== null).map((b) => b!);
  const attention = batchAttention(loaded, await findEstimatedIngredientIds());
  return NextResponse.json(loaded.map((b) => ({ ...presentBatch(b), attention: attention.get(b.id) ?? [] })));
}

export async function POST(req: NextRequest) {
  const parsed = batchRecipeInputSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { lines, createdBy, ...fields } = parsed.data;

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

  const created = await prisma.batchRecipe.create({
    data: { ...fields, createdBy, updatedBy: createdBy, lines: { create: lines } },
  });
  await syncBatchOutput(created.id, createdBy);
  return NextResponse.json(presentBatch((await loadBatch(created.id))!), { status: 201 });
}
