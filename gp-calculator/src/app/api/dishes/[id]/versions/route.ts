import { prisma } from "@/lib/prisma";
import { lineCost } from "@/lib/costing";
import { dishVersionInputSchema } from "@/lib/validation";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const json = await req.json();
  const parsed = dishVersionInputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { lines, ...versionFields } = parsed.data;

  const dish = await prisma.dish.findUnique({ where: { id: params.id } });
  if (!dish) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ingredients = await prisma.ingredient.findMany({
    where: { id: { in: lines.map((l) => l.ingredientId) } },
  });
  const ingredientMap = new Map(ingredients.map((i) => [i.id, i]));
  if (!lines.every((l) => ingredientMap.has(l.ingredientId))) {
    return NextResponse.json({ error: "One or more ingredients could not be found" }, { status: 400 });
  }

  // A submitted line's unit can be in a different family than its
  // ingredient's purchaseUnit (e.g. an EACH-purchased ingredient used with
  // unit "G") — lineCost() calls convert() internally, which throws on a
  // family mismatch. Without this guard that throw propagates as an
  // unhandled 500; catch it here and return a clean 400 instead.
  let lineData;
  try {
    lineData = lines.map((line) => {
      const ingredient = ingredientMap.get(line.ingredientId)!;
      const cost = lineCost(
        {
          purchaseUnit: ingredient.purchaseUnit,
          packQuantity: Number(ingredient.packQuantity),
          packPrice: Number(ingredient.packPrice),
          yieldPct: Number(ingredient.yieldPct),
        },
        line.quantity,
        line.unit
      );
      return {
        ingredientId: ingredient.id,
        ingredientNameSnapshot: ingredient.name,
        quantity: line.quantity,
        unit: line.unit,
        lineCostSnapshot: cost,
      };
    });
  } catch {
    return NextResponse.json(
      { error: "One or more recipe lines use a unit that doesn't match their ingredient" },
      { status: 400 }
    );
  }

  const costSnapshot = lineData.reduce((sum, l) => sum + l.lineCostSnapshot, 0);

  const latest = await prisma.dishVersion.findFirst({
    where: { dishId: params.id },
    orderBy: { versionNumber: "desc" },
  });

  try {
    const version = await prisma.dishVersion.create({
      data: {
        dishId: params.id,
        versionNumber: (latest?.versionNumber ?? 0) + 1,
        costSnapshot,
        ...versionFields,
        lines: { create: lineData },
      },
      include: { lines: true },
    });

    return NextResponse.json(version, { status: 201 });
  } catch (err) {
    // Two near-simultaneous version-create requests for the same dish can
    // both compute the same next versionNumber and race on the
    // @@unique([dishId, versionNumber]) constraint (P2002). Same
    // P2025-catch-and-404 pattern established elsewhere in this codebase,
    // applied here to P2002-catch-and-409.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "This dish was just updated by someone else. Please retry." },
        { status: 409 }
      );
    }
    throw err;
  }
}
