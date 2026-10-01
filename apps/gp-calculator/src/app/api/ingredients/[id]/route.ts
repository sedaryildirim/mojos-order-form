import { prisma } from "@/lib/db/prisma";
import { recordPriceHistory } from "@/lib/costing/price-history";
import { findCheaperAlternative } from "@/lib/costing/switch";
import { isPlaceholderSupplier } from "@/lib/costing/estimates";
import { recalculateDishVersionsForIngredients } from "@/lib/costing/recalc";
import { syncBatchesForIngredients } from "@/lib/costing/batch";
import { ingredientInputSchema } from "@/lib/db/validation";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { CONFLICT_MESSAGE } from "@/lib/db/conflict";
import { z } from "zod";

// .partial() alone is not safe to use here: zod 4's .partial() still applies
// .default() to a field that is entirely absent from the input, so a PATCH of
// just `{ archived: true, updatedBy: "..." }` would silently reintroduce
// `yieldPct: 100` into the update payload, corrupting a previously-set yield.
// Override yieldPct with the same constraint but no .default() before making
// everything else optional, so an absent field stays absent.
const patchSchema = ingredientInputSchema
  .extend({ yieldPct: z.number().gt(0).lte(100) })
  .partial()
  .extend({
    archived: z.boolean().optional(),
    priceEstimated: z.boolean().optional(),
    updatedBy: z.string().min(1),
    // When the edit form was opened. If the record changed since, refuse instead of overwriting someone else's edit.
    expectedUpdatedAt: z.string().datetime().optional(),
  });

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const ingredient = await prisma.ingredient.findUnique({
    where: { id: params.id },
    include: { supplier: { select: { id: true, name: true, archived: true } } },
  });
  if (!ingredient) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ...ingredient, cheaper: await findCheaperAlternative(ingredient.id) });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const json = await req.json();
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const before = await prisma.ingredient.findUnique({ where: { id: params.id }, include: { supplier: true } });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // An estimate can only be confirmed once it belongs to a real supplier.
  if (parsed.data.priceEstimated === false) {
    const supplier = parsed.data.supplierId
      ? await prisma.supplier.findUnique({ where: { id: parsed.data.supplierId } })
      : before.supplier;
    if (!supplier || isPlaceholderSupplier(supplier.name)) {
      return NextResponse.json(
        { error: "Choose the supplier you actually buy this from before confirming the price." },
        { status: 400 }
      );
    }
  }

  const { expectedUpdatedAt, ...changes } = parsed.data;
  if (expectedUpdatedAt && new Date(expectedUpdatedAt).getTime() !== before.updatedAt.getTime()) {
    return NextResponse.json({ error: CONFLICT_MESSAGE, code: "CONFLICT" }, { status: 409 });
  }

  try {
    const ingredient = await prisma.ingredient.update({
      // matching updatedAt in the same statement closes the gap between the check above and the write
      where: expectedUpdatedAt ? { id: params.id, updatedAt: new Date(expectedUpdatedAt) } : { id: params.id },
      data: changes,
    });

    // A changed price/pack/yield flows on to batches and dishes, like an import does.
    const pricingChanged =
      Number(before.packPrice) !== Number(ingredient.packPrice) ||
      Number(before.packQuantity) !== Number(ingredient.packQuantity) ||
      before.purchaseUnit !== ingredient.purchaseUnit ||
      Number(before.yieldPct) !== Number(ingredient.yieldPct);
    if (pricingChanged || before.supplierId !== ingredient.supplierId) {
      await recordPriceHistory(ingredient.id, parsed.data.updatedBy);
    }
    if (pricingChanged) {
      const outputs = await syncBatchesForIngredients([ingredient.id], parsed.data.updatedBy);
      await recalculateDishVersionsForIngredients([ingredient.id, ...outputs], parsed.data.updatedBy);
    }
    return NextResponse.json(ingredient);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      if (expectedUpdatedAt) return NextResponse.json({ error: CONFLICT_MESSAGE, code: "CONFLICT" }, { status: 409 });
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw err;
  }
}
